import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { ENDED_WITHOUT_RESULT } from './ticket-acceptance'

/**
 * Re-accepts a ticket that refreshes reopened with nothing new: since its last acceptance it only
 * took follow-ups that had settled before it, or saw an owner end without a result. A no-op once
 * repaired, and for any ticket that had new work since.
 */
export function restoreReopenedAcceptance(record: TmwkTicketRecord): TmwkTicketRecord {
  const index = record.history.findLastIndex((event) => event.kind === 'accepted')
  const since = record.history.slice(index + 1)
  if (record.status !== 'active' || record.question || index === -1 || since.length === 0) {
    return record
  }
  const acceptedAt = record.history[index].at
  const accepted = Date.parse(acceptedAt)
  const stale = since.every((event) => {
    const attempts = record.attempts.filter((attempt) => attempt.taskId === event.taskId)
    return (
      event.taskId !== undefined &&
      attempts.length > 0 &&
      attempts.every(
        (attempt) =>
          (attempt.followUpOf !== undefined &&
            attempt.settledAt !== undefined &&
            Date.parse(attempt.settledAt) <= accepted) ||
          ((event.kind === 'attempt-settled' || event.kind === 'attempt-lost') &&
            ENDED_WITHOUT_RESULT.has(attempt.outcome ?? ''))
      )
    )
  })
  return stale ? { ...record, status: 'accepted', acceptedAt } : record
}
