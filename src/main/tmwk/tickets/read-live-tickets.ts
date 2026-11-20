import { z } from 'zod'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import type { LiveTicket } from './ticket-store'

const MAIN_RUN_OBJECTIVE = 'main'
const INBOX_LIMIT = 2000

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

const GateList = z.object({
  gates: z.array(z.object({ task_id: z.string(), question: z.string() }))
})

const Inbox = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      body: z.string(),
      thread_id: z.string().nullable(),
      payload: z.string().nullable()
    })
  )
})

function titleOf(task: z.infer<typeof TaskList>['tasks'][number]): string {
  const named = task.task_title?.trim() || task.display_name?.trim()
  return named || task.spec.trim().split('\n')[0].slice(0, 120) || task.id
}

function questionTaskId(payload: string | null): string | null {
  try {
    const parsed: unknown = JSON.parse(payload ?? '')
    return typeof parsed === 'object' &&
      parsed !== null &&
      'taskId' in parsed &&
      typeof parsed.taskId === 'string'
      ? parsed.taskId
      : null
  } catch {
    return null
  }
}

/** A question mail with no reply in its thread is still waiting; replies carry the question id as thread_id. */
function pendingAsks(inbox: z.infer<typeof Inbox>['messages']): Map<string, string> {
  const answered = new Set(
    inbox.flatMap((m) => (m.thread_id && m.thread_id !== m.id ? [m.thread_id] : []))
  )
  const asks = new Map<string, string>()
  for (const message of inbox) {
    const taskId = message.type === 'question' ? questionTaskId(message.payload) : null
    if (taskId && !answered.has(message.id) && !asks.has(taskId)) {
      asks.set(taskId, message.body)
    }
  }
  return asks
}

export type LiveTicketRead = { tickets: LiveTicket[]; unreadRunIds: string[] }

async function readRunTickets(rpc: TmwkRpc, runId: string): Promise<LiveTicket[]> {
  const { tasks } = TaskList.parse(await rpc('orchestration.taskList', { run: runId }))
  const gates = GateList.parse(
    await rpc('orchestration.gateList', { run: runId, status: 'pending' })
  ).gates
  const asks = pendingAsks(
    Inbox.parse(await rpc('orchestration.inbox', { run: runId, limit: INBOX_LIMIT })).messages
  )
  return tasks.map((task) => {
    const gate = gates.find((g) => g.task_id === task.id)
    const ask =
      task.status === 'completed' || task.status === 'failed' ? undefined : asks.get(task.id)
    return {
      taskId: task.id,
      runId: task.run_id,
      title: titleOf(task),
      status: task.status,
      result: task.result,
      completedAt: task.completed_at,
      question: gate?.question ?? ask ?? null,
      owner: task.assignee_handle ?? null
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
