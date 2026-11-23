import type { OrchestrationDb } from '../../db/orchestration-db'
import { getRemoteDispatch } from '../../db/remote-owned/remote-dispatch-records'

/** A paired server's own worker: its report came home with the server's state, which settles the Task.
 * tmwk Maintain: a matching run settles it even when no local task row exists. */
export function isPairedServerOwnReport(
  db: OrchestrationDb,
  dispatchId: string,
  taskId: string,
  runId: string,
  onLog: (msg: string) => void
): boolean {
  const remote = getRemoteDispatch(db, dispatchId)
  const ownReport =
    !!remote &&
    (remote.run_id === runId ||
      (remote.task_id === taskId && !db.getDispatchContextById(dispatchId)))
  if (ownReport) {
    onLog(`worker_done for remote dispatch ${dispatchId} is a report only; settled via its server`)
  }
  return ownReport
}
