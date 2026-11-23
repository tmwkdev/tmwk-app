import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'

/** A rendered group; a collapsible one has a heading row that is itself a list item. */
export type TicketListGroup = { id: string; rows: TicketRowModel[]; collapsible: boolean }

/** One stop of the listbox's roving focus, in screen order. `groupId` is set inside collapsible groups. */
export type TicketListItem =
  | { key: string; kind: 'ticket'; row: TicketRowModel; groupId: string | null }
  | {
      key: string
      kind: 'session'
      row: TicketRowModel
      session: TicketRowSession
      groupId: string | null
    }
  | { key: string; kind: 'group'; groupId: string }

export function ticketItemKey(ticketId: string): string {
  return `ticket:${ticketId}`
}

export function sessionItemKey(ticketId: string, sessionId: string): string {
  return `session:${ticketId}:${sessionId}`
}

/** Per ticket whose worktree card shows, the sessions that card already lists as its own agent rows. */
export type TicketCardSessions = ReadonlyMap<string, ReadonlySet<string>>

/** The sessions to list beneath a ticket, leaving out those its worktree card lists. */
export function sessionsBesideCard(
  row: TicketRowModel,
  cardSessions: TicketCardSessions | undefined
): TicketRowSession[] {
  const listed = cardSessions?.get(row.id)
  return listed ? row.sessions.filter((session) => !listed.has(session.id)) : row.sessions
}

export function groupItemKey(groupId: string): string {
  return `group:${groupId}`
}

export function flattenTicketItems(
  groups: readonly TicketListGroup[],
  openIds: ReadonlySet<string>,
  collapsedIds: ReadonlySet<string>,
  cardSessions?: TicketCardSessions
): TicketListItem[] {
  const items: TicketListItem[] = []
  for (const group of groups) {
    const groupId = group.collapsible ? group.id : null
    if (group.collapsible) {
      if (group.rows.length === 0) {
        continue
      }
      items.push({ key: groupItemKey(group.id), kind: 'group', groupId: group.id })
      if (collapsedIds.has(group.id)) {
        continue
      }
    }
    for (const row of group.rows) {
      items.push({ key: ticketItemKey(row.id), kind: 'ticket', row, groupId })
      if (openIds.has(row.id)) {
        for (const session of sessionsBesideCard(row, cardSessions)) {
          items.push({
            key: sessionItemKey(row.id, session.id),
            kind: 'session',
            row,
            session,
            groupId
          })
        }
      }
    }
  }
  return items
}
