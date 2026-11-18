import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'

const MAX_LINES = 20
const TITLE_MAX = 80

/** One short line per changed ticket, newest first; empty when none changed. */
export function renderTicketChanges(tickets: TmwkTicket[]): string {
  const changed = [...tickets].sort((a, b) => b.changedAt - a.changedAt)
  const lines = changed.slice(0, MAX_LINES).map((ticket) => {
    const title =
      ticket.title.length > TITLE_MAX ? `${ticket.title.slice(0, TITLE_MAX - 1)}…` : ticket.title
    const notes = [
      ticket.status,
      ...(ticket.acceptedAt === null ? [] : ['accepted']),
      ...(ticket.needsMe === null ? [] : [`needs the user: ${ticket.needsMe}`])
    ]
    return `- ${title}: ${notes.join(', ')}`
  })
  if (changed.length > MAX_LINES) {
    lines.push(`- and ${changed.length - MAX_LINES} older changes`)
  }
  return lines.join('\n')
}
