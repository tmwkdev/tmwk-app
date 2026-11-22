import { TMWK_URL_SCHEME } from './identity/tmwk-url-scheme'

const TICKET_ID = 'tk_[0-9a-f]{8}'
const TICKET_ID_PATTERN = new RegExp(`^${TICKET_ID}$`)
/** A ticket id in prose: not part of a longer word, path or id. */
export const TMWK_TICKET_ID_IN_TEXT_PATTERN = new RegExp(
  `(?<![A-Za-z0-9_./-])${TICKET_ID}(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`,
  'g'
)

const TICKET_URL_PREFIX = `${TMWK_URL_SCHEME}://tickets/`
// Sanitize keeps fragment hrefs; it empties unknown schemes like the deep link's.
const TICKET_CHAT_HREF_PREFIX = '#tmwk-ticket='

export function isTmwkTicketId(value: string): boolean {
  return TICKET_ID_PATTERN.test(value)
}

/** The href a chat link to the ticket carries after markdown rewrites it. */
export function tmwkTicketChatHref(ticketId: string): string {
  return `${TICKET_CHAT_HREF_PREFIX}${ticketId}`
}

/** The ticket id a deep link or chat href names, or null. */
export function parseTmwkTicketHref(href: string | null | undefined): string | null {
  const trimmed = href?.trim() ?? ''
  let id: string | null = null
  if (trimmed.startsWith(TICKET_CHAT_HREF_PREFIX)) {
    id = trimmed.slice(TICKET_CHAT_HREF_PREFIX.length)
  } else if (trimmed.toLowerCase().startsWith(TICKET_URL_PREFIX)) {
    id = trimmed.slice(TICKET_URL_PREFIX.length).replace(/\/$/, '')
  }
  return id !== null && isTmwkTicketId(id) ? id : null
}
