import { z } from 'zod'
import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import type { LiveTicket } from './merge-live-tasks'
import { TaskList, titleOf } from './read-live-tickets'
import { readRunWorkers, type TicketFleetWorker } from './read-ticket-fleet'
import { isOpenAttempt } from './ticket-listing'
import { isServerLinkFailure } from './server-link-failure'

/** A dispatch Orca opened to continue a finished owner (`send --to dispatch:`), with its new Task. */
export type FollowUp = { followUpOf: string; dispatchId: string; taskId: string }

const WorkerShow = z.object({
  dispatch: z.object({ runId: z.string(), followUpOf: z.string().nullable().optional() })
})

type Lineage = { followUpOf: string | null; runId: string }

// A dispatch's lineage never changes, so each is read once per host; failed reads are retried.
const lineages = new Map<string, Lineage>()

function lineageKey(host: string | undefined, dispatchId: string): string {
  return JSON.stringify([host ?? null, dispatchId])
}

async function readLineage(
  rpc: TmwkRpc,
  host: string | undefined,
  dispatchId: string
): Promise<Lineage | null> {
  const key = lineageKey(host, dispatchId)
  const cached = lineages.get(key)
  if (cached) {
    return cached
  }
  try {
    const { dispatch } = WorkerShow.parse(
      await rpc('orchestration.workerShow', { dispatch: dispatchId })
    )
    const lineage = { followUpOf: dispatch.followUpOf ?? null, runId: dispatch.runId }
    lineages.set(key, lineage)
    return lineage
  } catch (error) {
    console.error(`[tmwk] follow-up lineage read failed for ${dispatchId}:`, error)
    return null
  }
}

type Settled = TmwkTicketAttempt & { dispatchId: string; taskId: string; runId: string }

const SETTLED: ReadonlySet<string> = new Set(['completed', 'failed'])

/** The latest attempt once it settled, or once its live Task did since the last refresh. */
function settledLatest(
  record: TmwkTicketRecord,
  liveStatus: ReadonlyMap<string, string>
): Settled | null {
  const latest = record.attempts.at(-1)
  const { dispatchId, taskId, runId } = latest ?? {}
  if (!latest || !dispatchId || !taskId || !runId) {
    return null
  }
  const settled = isOpenAttempt(latest)
    ? SETTLED.has(liveStatus.get(taskId) ?? '')
    : SETTLED.has(latest.outcome ?? '')
  return settled ? { ...latest, dispatchId, taskId, runId } : null
}

/** The ids tmwk's attempts name; a lone Task tmwk only found in Orca may yet be a follow-up. */
function namedIds(records: readonly TmwkTicketRecord[]): Set<string> {
  return new Set(
    records
      .filter((record) => record.origin !== 'orca' || record.attempts.length > 1)
      .flatMap((record) =>
        record.attempts.flatMap((attempt) => [attempt.dispatchId, attempt.taskId])
      )
      .filter((id): id is string => id !== undefined)
  )
}

type ServerTask = { host: string; dispatchId: string; taskId: string; runId: string }

type ServerTaskList = z.infer<typeof TaskList>['tasks']

/** Paired servers for one read: a host is skipped after its link fails, and each Run is listed once. */
function openServers(serverRpc: ((server: string) => TmwkRpc) | undefined) {
  const down = new Set<string>()
  const lists = new Map<string, Promise<ServerTaskList | null>>()
  const reach = (host: string): TmwkRpc | null => {
    const rpc = serverRpc?.(host)
    if (!rpc || down.has(host)) {
      return null
    }
    return async (method, params) => {
      try {
        return await rpc(method, params)
      } catch (error) {
        if (isServerLinkFailure(error)) {
          down.add(host)
        }
        throw error
      }
    }
  }
  const listTasks = (host: string, rpc: TmwkRpc, runId: string) => {
    const key = JSON.stringify([host, runId])
    let list = lists.get(key)
    if (!list) {
      list = (async () => {
        try {
          return TaskList.parse(await rpc('orchestration.taskList', { run: runId })).tasks
        } catch (error) {
          console.error(`[tmwk] follow-up task read failed on ${host} for run ${runId}:`, error)
          return null
        }
      })()
      lists.set(key, list)
    }
    return list
  }
  return { reach, listTasks }
}

/** The server Task's live entry under the home Run; `gone` when the server listed its Run without it. */
async function readServerTask(
  servers: ReturnType<typeof openServers>,
  { host, dispatchId, taskId, runId }: ServerTask
): Promise<LiveTicket | 'gone' | null> {
  const rpc = servers.reach(host)
  const lineage = rpc ? await readLineage(rpc, host, dispatchId) : null
  const tasks = rpc && lineage ? await servers.listTasks(host, rpc, lineage.runId) : null
  if (!tasks) {
    return null
  }
  const task = tasks.find((candidate) => candidate.id === taskId)
  if (!task) {
    return 'gone'
  }
  return {
    taskId,
    runId,
    title: titleOf(task),
    status: task.status,
    result: task.result,
    completedAt: task.completed_at,
    question: null,
    owner: task.assignee_handle ?? null,
    ownerGone: null
  }
}

/**
 * Dispatches that continue a ticket's settled latest attempt, which Orca records only on the new
 * dispatch, plus live entries for follow-ups on paired servers, whose Tasks home's Run never lists,
 * and the follow-up Tasks a server no longer has. `live` is this refresh's home read. `serverRpc`
 * reaches a paired server by name; without it servers give nothing.
 */
export async function readFollowUps(
  rpc: TmwkRpc,
  records: readonly TmwkTicketRecord[],
  live: readonly LiveTicket[],
  serverRpc?: (server: string) => TmwkRpc
): Promise<{ followUps: FollowUp[]; live: LiveTicket[]; gone: string[] }> {
  const servers = openServers(serverRpc)
  const seen = new Set<string>()
  const entries: LiveTicket[] = []
  const gone: string[] = []
  const readServerTasks = async (tasks: readonly ServerTask[]) => {
    for (const task of tasks) {
      seen.add(lineageKey(task.host, task.dispatchId))
      const entry = await readServerTask(servers, task)
      if (entry === 'gone') {
        gone.push(task.taskId)
      } else if (entry) {
        entries.push(entry)
      }
    }
  }
  // Open server follow-ups first, so one that settled there can take its own follow-up now.
  await readServerTasks(
    records.flatMap((record) => {
      const open = record.attempts.at(-1)
      const { followUpOf, host, dispatchId, taskId, runId } = open ?? {}
      return isOpenAttempt(open) && followUpOf && host && dispatchId && taskId && runId
        ? [{ host, dispatchId, taskId, runId }]
        : []
    })
  )
  const liveStatus = new Map(
    [...live, ...entries].map((entry) => [entry.taskId, entry.status] as const)
  )
  const latest = records.flatMap((record) => settledLatest(record, liveStatus) ?? [])
  const byDispatch = new Map(latest.map((attempt) => [attempt.dispatchId, attempt]))
  const named = namedIds(records)
  const followUps: FollowUp[] = []
  const serverTasks: ServerTask[] = []
  for (const runId of new Set(latest.map((attempt) => attempt.runId))) {
    let workers: TicketFleetWorker[]
    try {
      workers = await readRunWorkers(rpc, runId)
    } catch (error) {
      console.error(`[tmwk] follow-up read failed for run ${runId}:`, error)
      continue
    }
    const inRun = latest.filter((attempt) => attempt.runId === runId)
    for (const row of workers) {
      const host = row.server?.name
      seen.add(lineageKey(host, row.dispatchId))
      if (
        row.parentTaskId !== null ||
        named.has(row.dispatchId) ||
        named.has(row.taskId) ||
        !inRun.some((attempt) => attempt.host === host)
      ) {
        continue
      }
      const reach = host ? servers.reach(host) : rpc
      const lineage = reach ? await readLineage(reach, host, row.dispatchId) : null
      const of = lineage?.followUpOf ? byDispatch.get(lineage.followUpOf) : undefined
      if (!of || of.runId !== runId || of.host !== host) {
        continue
      }
      followUps.push({ followUpOf: of.dispatchId, dispatchId: row.dispatchId, taskId: row.taskId })
      if (host) {
        serverTasks.push({ host, dispatchId: row.dispatchId, taskId: row.taskId, runId })
      }
    }
  }
  await readServerTasks(serverTasks)
  for (const key of lineages.keys()) {
    if (!seen.has(key)) {
      lineages.delete(key)
    }
  }
  return { followUps, live: entries, gone }
}
