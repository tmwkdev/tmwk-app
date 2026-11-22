import { parseTmwkTicketHref } from '../../../../../shared/tmwk/tmwk-ticket-link'
import { showInMainView } from './ticket-sidebar-store'

/** Opens the ticket a chat link names in the main view; false leaves other links to their handler. */
export function openTicketLinkClick(
  event: { preventDefault(): void },
  href: string | undefined
): boolean {
  const ticketId = parseTmwkTicketHref(href)
  if (!ticketId) {
    return false
  }
  event.preventDefault()
  showInMainView(ticketId)
  return true
}
