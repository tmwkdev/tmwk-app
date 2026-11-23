import { z } from 'zod'
import type { TicketSessionStatus } from '../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { isOpenAttempt } from './ticket-listing'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

/** One `workerList` row as the overview reads it; a paired server's row has no projection (W1 spike 3). */
export type TicketFleetWorker = {
  dispatchId: string
  taskId: string
  parentTaskId: string | null
  agent: string | null
  model: string | null
  terminalHandle: string | null
  worktreeId: string | null
  status: TicketSessionStatus
  /** An SSH execution host; null for the home host and paired servers. */
  executionHostId: string | null
  hostUnavailable: boolean
  lastActivityAt: string | null
  server: { environmentId: string; name: string; asOf: string } | null
  /** Stopped or failed, so Orca closed its questions (closeQuestionsForDispatch). */
  ended: boolean
}

export type TicketServerReach = { reachable: boolean | null; lastAnsweredAt: string | null }

export type TicketFleet = {
  workers: Map<string, TicketFleetWorker>
  /** `workerShow` reachability, by the dispatch id of an open attempt on a paired server. */
  servers: Map<string, TicketServerReach>
}

const PAGE_LIMIT = 100
const MAX_PAGES = 3

const Projection = z.object({
  parent: z.object({ taskId: z.string() }).nullable().optional(),
  provider: z.object({ id: z.string(), model: z.string().nullable() }).nullable().optional(),
  host: z.object({ kind: z.string(), id: z.string() }).optional(),
  workspace: z.object({ id: z.string() }).nullable().optional(),
  stage: z.object({ activity: z.string() }).optional(),
  outcome: z.string().optional(),
  liveness: z.object({ verdict: z.string(), reason: z.string().optional() }).optional(),
  evidence: z.object({ lastObservedAt: z.number().nullable() }).optional(),
  attention: z.object({ categories: z.array(z.string()) }).optional()
})

const WorkerRow = z.object({
  dispatchId: z.string(),
  taskId: z.string(),
  agentTerminalHandle: z.string().nullable().optional(),
  workerState: z.string().nullable().optional(),
  dispatchStatus: z.string().nullable().optional(),
  resource: z.object({ worktreeId: z.string().nullable() }).nullable().optional(),
  projection: Projection.nullable().optional(),
  server: z.object({ environmentId: z.string(), name: z.string(), asOf: z.string() }).optional()
})

const WorkerPage = z.object({
  workers: z.array(z.unknown()),
  page: z.object({ nextCursor: z.string().nullable() }).optional()
})

const WorkerShow = z.object({
  server: z
    .object({ reachable: z.boolean().optional(), lastAnsweredAt: z.string().optional() })
    .optional()
})

// A stop or failure closes the dispatch's questions. A worker still asks after a successful
// report, and `start_unknown` keeps its authority, so both keep theirs.
const ENDED_DISPATCH = new Set(['failed', 'circuit_broken'])
const ENDED_WORKER = new Set(['stopping', 'stop_unknown', 'stopped', 'abandoned', 'failed'])

const QUESTION_CATEGORIES = new Set(['input', 'approval', 'guidance'])

const ACTIVITY_STATUS = new Map<string, TicketSessionStatus>([
  ['working', 'working'],
  ['waiting', 'waiting'],
  ['blocked', 'waiting'],
  ['done', 'done']
])

function sessionStatus(projection: z.infer<typeof Projection>): TicketSessionStatus {
  if (projection.attention?.categories.some((category) => QUESTION_CATEGORIES.has(category))) {
    return 'question'
  }
  if (projection.outcome === 'failed') {
    return 'failed'
  }
  if (projection.outcome === 'succeeded' || projection.outcome === 'finished_unverified') {
    return 'done'
  }
  return ACTIVITY_STATUS.get(projection.stage?.activity ?? '') ?? 'idle'
}

function toWorker(row: z.infer<typeof WorkerRow>): TicketFleetWorker {
  const projection = row.projection ?? null
  const observedAt = projection?.evidence?.lastObservedAt ?? null
  const remoteHost = projection?.host?.kind === 'remote' ? projection.host.id : null
  return {
    dispatchId: row.dispatchId,
    taskId: row.taskId,
    parentTaskId: projection?.parent?.taskId ?? null,
    agent: projection?.provider?.id ?? null,
    model: projection?.provider?.model ?? null,
    terminalHandle: row.agentTerminalHandle ?? null,
    worktreeId: row.resource?.worktreeId ?? projection?.workspace?.id ?? null,
    status: projection ? sessionStatus(projection) : 'idle',
    executionHostId: remoteHost,
    hostUnavailable: projection?.liveness?.reason === 'host_unavailable',
    lastActivityAt:
      observedAt !== null ? new Date(observedAt).toISOString() : (row.server?.asOf ?? null),
    server: row.server ?? null,
    ended: ENDED_DISPATCH.has(row.dispatchStatus ?? '') || ENDED_WORKER.has(row.workerState ?? '')
  }
}

/** Every `workerList` row of one Run, paired servers' included. */
export async function readRunWorkers(rpc: TmwkRpc, runId: string): Promise<TicketFleetWorker[]> {
  const workers: TicketFleetWorker[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = WorkerPage.parse(
      await rpc('orchestration.workerList', {
        run: runId,
        limit: PAGE_LIMIT,
        paginate: true,
        includeRemote: true,
        ...(cursor ? { cursor } : {})
      })
    )
    for (const raw of result.workers) {
      const row = WorkerRow.safeParse(raw)
      if (row.success) {
        workers.push(toWorker(row.data))
      }
    }
    cursor = result.page?.nextCursor ?? null
    if (!cursor) {
      break
    }
  }
  return workers
}

/**
 * The fleet rows for the Runs the tickets' attempts live in, joined later by dispatch id, plus
 * `workerShow` reachability for each open attempt on a paired server (D57, D67 as W1 changed them).
 * Null when the fleet cannot be read, so rows keep the records' values.
 */
export async function readTicketFleet(
  rpc: TmwkRpc,
  records: readonly TmwkTicketRecord[]
): Promise<TicketFleet | null> {
  const runIds = new Set(
    records.flatMap((record) => record.attempts.flatMap((attempt) => attempt.runId ?? []))
  )
  const workers = new Map<string, TicketFleetWorker>()
  try {
    for (const runId of runIds) {
      for (const worker of await readRunWorkers(rpc, runId)) {
        workers.set(worker.dispatchId, worker)
      }
    }
  } catch (error) {
    console.error('[tmwk] ticket overview fleet read failed:', error)
    return null
  }
  const servers = new Map<string, TicketServerReach>()
  const remote = records.flatMap((record) =>
    record.attempts.flatMap((attempt) =>
      isOpenAttempt(attempt) && attempt.host !== undefined && attempt.dispatchId
        ? [attempt.dispatchId]
        : []
    )
  )
  await Promise.all(
    remote.map(async (dispatchId) => {
      try {
        const shown = WorkerShow.parse(
          await rpc('orchestration.workerShow', { dispatch: dispatchId })
        )
        servers.set(dispatchId, {
          reachable: shown.server?.reachable ?? null,
          lastAnsweredAt: shown.server?.lastAnsweredAt ?? null
        })
      } catch (error) {
        console.error(`[tmwk] worker show failed for ${dispatchId}:`, error)
      }
    })
  )
  return { workers, servers }
}
