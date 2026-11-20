import {
  RUNNING_STATUSES,
  type TmwkNeedsMe,
  type TmwkTicketListing,
  type TmwkTicketStatus
} from '../tmwk-tickets'
import { compareByAttention } from './ticket-attention'
import type { TicketState } from './ticket-row-model'

export function classifyNeedsMe(ticket: {
  status: TmwkTicketStatus
  question: string | null
  acceptedAt: string | null
}): TmwkNeedsMe | null {
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

export type TicketStateInput = Pick<TmwkTicketListing, 'needsMe' | 'acceptedAt' | 'status' | 'kind'>

/** A listing's place in the attention order; `hostUnreachable` pauses running work but never hides what needs the user. */
export function deriveTicketState(
  ticket: TicketStateInput,
  { hostUnreachable = false }: { hostUnreachable?: boolean } = {}
): TicketState {
  if (ticket.needsMe === 'decision') {
    return 'decision'
  }
  if (ticket.acceptedAt !== null) {
    return 'done'
  }
  if (ticket.needsMe !== null) {
    return ticket.needsMe
  }
  if (RUNNING_STATUSES.includes(ticket.status)) {
    return hostUnreachable ? 'paused' : 'running'
  }
  return 'waiting'
}

/** Listings in the overview's attention order, so `tmwk tickets` and the sidebar agree. */
export function orderTickets<T extends TicketStateInput & Pick<TmwkTicketListing, 'changedAt'>>(
  tickets: readonly T[]
): T[] {
  const keyed = tickets.map((ticket) => ({
    ticket,
    key: { state: deriveTicketState(ticket), kind: ticket.kind, changedAt: ticket.changedAt }
  }))
  return keyed.sort((a, b) => compareByAttention(a.key, b.key)).map(({ ticket }) => ticket)
}
