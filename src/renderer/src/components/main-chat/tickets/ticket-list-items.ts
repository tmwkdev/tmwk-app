import type { AttentionSections } from '../../../../../shared/tmwk/ticket-overview/ticket-attention'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'

/** One stop of the listbox's roving focus, in screen order. */
export type TicketListItem =
  | { key: string; kind: 'ticket'; row: TicketRowModel }
  | { key: string; kind: 'session'; row: TicketRowModel; session: TicketRowSession }
  | { key: string; kind: 'done' }

export const DONE_ITEM_KEY = 'done'

export function ticketItemKey(ticketId: string): string {
  return `ticket:${ticketId}`
}

export function sessionItemKey(ticketId: string, sessionId: string): string {
  return `session:${ticketId}:${sessionId}`
}

export function flattenTicketItems(
  sections: AttentionSections,
  openIds: ReadonlySet<string>,
  doneOpen: boolean
): TicketListItem[] {
  const items: TicketListItem[] = []
  const pushTicket = (row: TicketRowModel): void => {
    items.push({ key: ticketItemKey(row.id), kind: 'ticket', row })
    if (openIds.has(row.id)) {
      for (const session of row.sessions) {
        items.push({ key: sessionItemKey(row.id, session.id), kind: 'session', row, session })
      }
    }
  }
  sections.needsYou.forEach(pushTicket)
  sections.quiet.forEach(pushTicket)
  if (sections.done.length > 0) {
    items.push({ key: DONE_ITEM_KEY, kind: 'done' })
    if (doneOpen) {
      sections.done.forEach(pushTicket)
    }
  }
  return items
}
