import type { TmwkTicketOutcomeCounts } from '../../../shared/tmwk/tmwk-health'
import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { isOpenAttempt } from './ticket-listing'

/** When the attempt settled: Orca's completion time, falling back to `settledAt` (ticket-history-plan, Counting). */
function settledTime(attempt: TmwkTicketAttempt): number {
  return Date.parse(attempt.observed?.completedAt ?? attempt.settledAt ?? '')
}

/** One count per ticket, by its latest attempt's outcome if it settled at or after `since`; ongoing tickets never count as completed. */
export function countTicketOutcomes(
  records: readonly TmwkTicketRecord[],
  since: number
): TmwkTicketOutcomeCounts {
  const counts: TmwkTicketOutcomeCounts = { completed: 0, failed: 0, lost: 0, open: 0 }
  for (const record of records) {
    const latest = record.attempts.at(-1)
    if (!latest) {
      continue
    }
    if (isOpenAttempt(latest)) {
      counts.open += 1
      continue
    }
    if (!(settledTime(latest) >= since)) {
      continue
    }
    if (latest.outcome === 'completed' && record.kind !== 'ongoing') {
      counts.completed += 1
    } else if (latest.outcome === 'failed' || latest.outcome === 'failed_start') {
      counts.failed += 1
    } else if (latest.outcome === 'lost') {
      counts.lost += 1
    }
  }
  return counts
}
