import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import type { LiveTicket } from './merge-live-tasks'
import { readRunWorkers, type TicketFleetWorker } from './read-ticket-fleet'

/** What Orca's dispatch record gives an attempt started outside `ticket start`. */
export type TaskDispatch = Pick<
  TmwkTicketAttempt,
  'dispatchId' | 'host' | 'agent' | 'model' | 'worktreeId' | 'terminalHandle'
> & { dispatchId: string }

const SETTLED = new Set(['done', 'failed'])

function toDispatch(worker: TicketFleetWorker): TaskDispatch {
  return {
    dispatchId: worker.dispatchId,
    ...(worker.server ? { host: worker.server.name } : {}),
    ...(worker.agent ? { agent: worker.agent } : {}),
    ...(worker.model ? { model: worker.model } : {}),
    ...(worker.worktreeId ? { worktreeId: worker.worktreeId } : {}),
    ...(worker.terminalHandle ? { terminalHandle: worker.terminalHandle } : {})
  }
}

/**
 * The owner dispatch of each live Task no attempt links to yet, by task id: a ticket imported from
 * Orca, or started with plain `worker-start`. A helper (one with a parent Task) never counts, and a
 * Task with several dispatches takes an unsettled one first. A failed Run read gives none.
 */
export async function readTaskDispatches(
  rpc: TmwkRpc,
  records: readonly TmwkTicketRecord[],
  live: readonly LiveTicket[]
): Promise<Map<string, TaskDispatch>> {
  const linked = new Set(
    records.flatMap((record) =>
      record.attempts.flatMap((attempt) =>
        attempt.dispatchId && attempt.taskId ? [attempt.taskId] : []
      )
    )
  )
  const unlinked = live.filter((entry) => !linked.has(entry.taskId))
  const found = new Map<string, TaskDispatch>()
  for (const runId of new Set(unlinked.map((entry) => entry.runId))) {
    let workers: TicketFleetWorker[]
    try {
      workers = await readRunWorkers(rpc, runId)
    } catch (error) {
      console.error(`[tmwk] dispatch read failed for run ${runId}:`, error)
      continue
    }
    for (const entry of unlinked.filter((ticket) => ticket.runId === runId)) {
      const owners = workers.filter(
        (worker) => worker.taskId === entry.taskId && worker.parentTaskId === null
      )
      const owner = owners.find((worker) => !SETTLED.has(worker.status)) ?? owners[0]
      if (owner) {
        found.set(entry.taskId, toDispatch(owner))
      }
    }
  }
  return found
}
