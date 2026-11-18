import type { TmwkNeedsMe, TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'

const RANK: Record<TmwkNeedsMe, number> = { decision: 0, stop: 1, result: 2 }

export function classifyNeedsMe(
  ticket: Pick<TmwkTicket, 'status' | 'question' | 'acceptedAt'>
): TmwkNeedsMe | null {
  if (ticket.question !== null) {
    return 'decision'
  }
  if (ticket.status === 'failed' || ticket.status === 'blocked') {
    return 'stop'
  }
  if (ticket.status === 'completed' && ticket.acceptedAt === null) {
    return 'result'
  }
  return null
}

/** Needs-me first (decision, stop, result), then the rest; newest change first within each. */
export function orderTickets<T extends Pick<TmwkTicket, 'needsMe' | 'changedAt'>>(
  tickets: readonly T[]
): T[] {
  const rank = (ticket: T): number =>
    ticket.needsMe === null ? Object.keys(RANK).length : RANK[ticket.needsMe]
  return [...tickets].sort((a, b) => rank(a) - rank(b) || b.changedAt - a.changedAt)
}
