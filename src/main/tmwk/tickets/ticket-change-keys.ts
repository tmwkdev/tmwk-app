import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'

/** The listed fields whose change moves a ticket to a new version. */
export function observableKey(ticket: TmwkTicketListing): string {
  return JSON.stringify([
    ticket.status,
    ticket.result,
    ticket.needsMe,
    ticket.question,
    ticket.title,
    ticket.acceptedAt,
    ticket.ticketStatus,
    ticket.attempts,
    ticket.failure,
    ticket.pr,
    ticket.source
  ])
}

// lastSeenAt moves on every read, so it alone never rewrites the file.
export function contentKey(record: TmwkTicketRecord): string {
  return JSON.stringify(record, (key, value: unknown) => (key === 'lastSeenAt' ? undefined : value))
}
