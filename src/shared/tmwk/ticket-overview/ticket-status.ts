import type { TicketRowModel, TicketState } from './ticket-row-model'

/** The Group by Status sections. */
export type TicketStatus =
  | 'needsDecision'
  | 'blocked'
  | 'readyForReview'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'done'

const STATUS_BY_STATE: Record<TicketState, TicketStatus> = {
  decision: 'needsDecision',
  stop: 'blocked',
  result: 'readyForReview',
  running: 'running',
  waiting: 'waiting',
  paused: 'paused',
  done: 'done'
}

export const DEFAULT_TICKET_STATUS_ORDER: readonly TicketStatus[] = [
  'needsDecision',
  'blocked',
  'readyForReview',
  'running',
  'waiting',
  'paused',
  'done'
]

export function statusOf(row: Pick<TicketRowModel, 'state'>): TicketStatus {
  return STATUS_BY_STATE[row.state]
}

/** A saved order with unknown entries dropped and missing statuses appended in default order. */
export function normalizeStatusOrder(order: readonly string[] | undefined): TicketStatus[] {
  const known = new Set<string>(DEFAULT_TICKET_STATUS_ORDER)
  const picked = [...new Set(order ?? [])].filter((status): status is TicketStatus =>
    known.has(status)
  )
  return [...picked, ...DEFAULT_TICKET_STATUS_ORDER.filter((status) => !picked.includes(status))]
}
