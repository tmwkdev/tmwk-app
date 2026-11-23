import { z } from 'zod'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import type { LiveTicket } from './ticket-store'
import { readRunWorkers, type TicketFleetWorker } from './read-ticket-fleet'

const MAIN_RUN_OBJECTIVE = 'main'
export const INBOX_LIMIT = 2000

const RunList = z.object({ runs: z.array(z.object({ id: z.string(), objective: z.string() })) })

const TaskList = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      run_id: z.string(),
      task_title: z.string().nullable().optional(),
      display_name: z.string().nullable().optional(),
      spec: z.string(),
      status: z.enum(['pending', 'ready', 'dispatched', 'completed', 'failed', 'blocked']),
      result: z.string().nullable(),
      completed_at: z.string().nullable(),
      assignee_handle: z.string().nullable().optional()
    })
  )
})

export const GateList = z.object({
  gates: z.array(
    z.object({
      id: z.string(),
      task_id: z.string(),
      question: z.string(),
      options: z.string().nullable().optional(),
      created_at: z.string().nullable().optional()
    })
  )
})

export const Inbox = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      body: z.string(),
      thread_id: z.string().nullable(),
      payload: z.string().nullable(),
      created_at: z.string().nullable().optional()
    })
  )
})

/** An unanswered question mail: its message id, text and offered options. */
export type PendingQuestion = {
  id: string
  text: string
  options: string[]
  askedAt: string | null
}

function titleOf(task: z.infer<typeof TaskList>['tasks'][number]): string {
  const named = task.task_title?.trim() || task.display_name?.trim()
  return named || task.spec.trim().split('\n')[0].slice(0, 120) || task.id
}

const QuestionPayload = z.object({
  taskId: z.string(),
  dispatchId: z.string().optional(),
  options: z.array(z.string()).optional()
})

function questionPayload(payload: string | null): z.infer<typeof QuestionPayload> | null {
  try {
    const parsed = QuestionPayload.safeParse(JSON.parse(payload ?? ''))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** A gate's options are stored as a JSON array of strings. */
export function gateOptions(options: string | null | undefined): string[] {
  try {
    const parsed = z.array(z.string()).safeParse(JSON.parse(options ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

/**
 * A question mail with no reply in its thread is still waiting (replies carry the question id as
 * thread_id), unless its dispatch ended: Orca closes it then, which no inbox copy shows.
 */
export function pendingAsks(
  inbox: z.infer<typeof Inbox>['messages'],
  endedDispatches: ReadonlySet<string> = new Set()
): Map<string, PendingQuestion> {
  const answered = new Set(
    inbox.flatMap((m) => (m.thread_id && m.thread_id !== m.id ? [m.thread_id] : []))
  )
  const asks = new Map<string, PendingQuestion>()
  for (const message of inbox) {
    const payload = message.type === 'question' ? questionPayload(message.payload) : null
    const closed = payload?.dispatchId !== undefined && endedDispatches.has(payload.dispatchId)
    if (payload && !closed && !answered.has(message.id) && !asks.has(payload.taskId)) {
      asks.set(payload.taskId, {
        id: message.id,
        text: message.body,
        options: payload.options ?? [],
        askedAt: message.created_at ?? null
      })
    }
  }
  return asks
}

function endedDispatches(workers: readonly TicketFleetWorker[]): Set<string> {
  return new Set(workers.flatMap((worker) => (worker.ended ? [worker.dispatchId] : [])))
}

/** The Run's stopped or failed dispatches, paired servers' included. */
export async function readEndedDispatches(rpc: TmwkRpc, runId: string): Promise<Set<string>> {
  return endedDispatches(await readRunWorkers(rpc, runId))
}

const EscalationPayload = z.object({
  dispatchId: z.string(),
  stopReason: z.string().optional()
})

type Escalation = z.infer<typeof EscalationPayload>

function escalationPayload(payload: string | null): Escalation | null {
  try {
    const parsed = EscalationPayload.safeParse(JSON.parse(payload ?? ''))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const STOP_REASONS = new Map([
  ['exited', "Its owner's terminal exited before it reported."],
  ['lost', "Its owner's terminal was closed before it reported."]
])

/**
 * Why a `ready` Task's owners all ended without a report (Orca put the Task back to ready), from
 * the newest escalation Orca mailed for one of them; null while an owner is live or none ran.
 */
function ownerGoneReason(
  taskId: string,
  workers: readonly TicketFleetWorker[],
  escalations: readonly Escalation[]
): string | null {
  const owners = workers.filter((w) => w.taskId === taskId && w.parentTaskId === null)
  if (owners.length === 0 || owners.some((owner) => !owner.ended)) {
    return null
  }
  const ids = new Set(owners.map((owner) => owner.dispatchId))
  const escalation = escalations.find((payload) => ids.has(payload.dispatchId))
  return STOP_REASONS.get(escalation?.stopReason ?? '') ?? 'Its owner stopped before it reported.'
}

export type LiveTicketRead = { tickets: LiveTicket[]; unreadRunIds: string[] }

async function readRunTickets(rpc: TmwkRpc, runId: string): Promise<LiveTicket[]> {
  const { tasks } = TaskList.parse(await rpc('orchestration.taskList', { run: runId }))
  const gates = GateList.parse(
    await rpc('orchestration.gateList', { run: runId, status: 'pending' })
  ).gates
  const { messages } = Inbox.parse(
    await rpc('orchestration.inbox', { run: runId, limit: INBOX_LIMIT })
  )
  const workers = await readRunWorkers(rpc, runId)
  const asks = pendingAsks(messages, endedDispatches(workers))
  const escalations = messages.flatMap((m) =>
    m.type === 'escalation' ? (escalationPayload(m.payload) ?? []) : []
  )
  return tasks.map((task) => {
    const gate = gates.find((g) => g.task_id === task.id)
    const ask =
      task.status === 'completed' || task.status === 'failed' ? undefined : asks.get(task.id)?.text
    return {
      taskId: task.id,
      runId: task.run_id,
      title: titleOf(task),
      status: task.status,
      result: task.result,
      completedAt: task.completed_at,
      question: gate?.question ?? ask ?? null,
      owner: task.assignee_handle ?? null,
      ownerGone: task.status === 'ready' ? ownerGoneReason(task.id, workers, escalations) : null
    }
  })
}

/**
 * Tasks of every Run whose objective is `main` (the partner's Run; the coordinator session id is
 * hidden by runList), with open gates and unanswered asks folded into `question`. A Run whose
 * reads fail is reported in `unreadRunIds` and skipped, so its snapshots stay as they were.
 */
export async function readLiveTickets(rpc: TmwkRpc): Promise<LiveTicketRead> {
  const runs = RunList.parse(await rpc('orchestration.runList')).runs.filter(
    (run) => run.objective.trim().toLowerCase() === MAIN_RUN_OBJECTIVE
  )
  const tickets: LiveTicket[] = []
  const unreadRunIds: string[] = []
  for (const run of runs) {
    try {
      tickets.push(...(await readRunTickets(rpc, run.id)))
    } catch (error) {
      console.error(`[tmwk] ticket read failed for run ${run.id}:`, error)
      unreadRunIds.push(run.id)
    }
  }
  return { tickets, unreadRunIds }
}
