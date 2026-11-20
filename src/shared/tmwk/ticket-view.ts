import type { TicketRowModel } from './ticket-overview/ticket-row-model'
import type { TmwkTicketRecord } from './tmwk-ticket-record'

/**
 * The decision a ticket waits on. `ask`: the partner's `ticket ask`; `gate`: an Orca gate on the
 * attempt's Task; `question`: a worker's unanswered question mail. `id` is the question, gate or
 * message id.
 */
export type TicketDecision = {
  kind: 'ask' | 'gate' | 'question'
  id: string
  text: string
  recommend: string | null
  options: string[]
  askedAt: string | null
}

/** What `tmwk.ticketView` returns: the record for the thread, its row for the header and rail, and the open decision. */
export type TmwkTicketView = {
  version: number
  ticket: TmwkTicketRecord
  row: TicketRowModel
  decision: TicketDecision | null
}
