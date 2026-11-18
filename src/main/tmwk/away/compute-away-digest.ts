import { RUNNING_STATUSES } from '../briefing/render-context-block'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { renderAwayDigest } from './render-away-digest'

/** The digest for tickets changed after `digestVersion`, and the ticket version it was computed at. */
export async function computeAwayDigest(input: {
  digestVersion: number
  awaySince: string
  now?: Date
}): Promise<{ text: string | null; version: number }> {
  const { version, tickets } = await openTmwkTicketStore().list()
  const text = renderAwayDigest({
    changed: tickets.filter((ticket) => ticket.changedAt > input.digestVersion),
    needsMe: tickets.filter((ticket) => ticket.needsMe !== null),
    running: tickets.filter(
      (ticket) => ticket.needsMe === null && RUNNING_STATUSES.includes(ticket.status)
    ).length,
    awaySince: input.awaySince,
    now: input.now ?? new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  return { text, version }
}
