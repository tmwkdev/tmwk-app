import type { TmwkNeedsMe, TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import { orderTickets } from '../tickets/needs-me-order'

const TITLE_MAX = 80
const DETAIL_MAX = 160
const NEEDS_ME_LABEL: Record<TmwkNeedsMe, string> = {
  decision: 'Decision',
  stop: 'Stop',
  result: 'Result'
}

export type AwayDigestInput = {
  /** Snapshots whose `changedAt` is above the digest version. */
  changed: TmwkTicketListing[]
  /** Every open ticket that needs the user, changed or not. */
  needsMe: TmwkTicketListing[]
  running: number
  awaySince: string
  now: Date
  timeZone: string
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function firstLine(text: string | null): string {
  return clip((text ?? '').trim().split('\n')[0], DETAIL_MAX)
}

function formatSince(awaySince: string, now: Date, timeZone: string): string {
  const at = new Date(awaySince)
  const day = (date: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(at)
  if (day(at) === day(now)) {
    return time
  }
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(at)
  return `${date} ${time}`
}

function needsMeLine(ticket: TmwkTicketListing): string {
  const title = clip(ticket.title, TITLE_MAX)
  const detail =
    ticket.needsMe === 'decision'
      ? firstLine(ticket.question)
      : firstLine(ticket.result) || ticket.status
  return `- ${NEEDS_ME_LABEL[ticket.needsMe ?? 'result']}: ${title}: ${detail}`
}

/** Null when nothing changed that the user has not been told about; the lines are facts only, the partner adds none. */
export function renderAwayDigest(input: AwayDigestInput): string | null {
  const handled = input.changed.filter(
    (ticket) => ticket.needsMe === null && ticket.status === 'completed'
  )
  const newlyNeedsMe = input.changed.some((ticket) => ticket.needsMe !== null)
  if (!newlyNeedsMe && handled.length === 0) {
    return null
  }
  const lines = [
    `While you were away (since ${formatSince(input.awaySince, input.now, input.timeZone)})`
  ]
  const open = orderTickets(input.needsMe)
  if (open.length > 0) {
    lines.push('Needs you', ...open.map(needsMeLine))
  }
  if (handled.length > 0) {
    lines.push(
      'Handled by owners',
      ...handled.map((ticket) => `- ${clip(ticket.title, TITLE_MAX)}: completed and accepted`)
    )
  }
  lines.push(
    `Still running: ${input.running}`,
    '',
    'Post exactly one message from this, in this order.',
    'Add nothing from memory.',
    'Say nothing if the user has already moved on.'
  )
  return lines.join('\n')
}
