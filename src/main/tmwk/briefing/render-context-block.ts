import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import {
  RUNNING_STATUSES,
  type TmwkNeedsMe,
  type TmwkTicketListing
} from '../../../shared/tmwk/tmwk-tickets'
import { orderTickets } from '../tickets/needs-me-order'
import { renderPreferenceBriefing } from './render-preference-briefing'

export const CONTEXT_BLOCK_BUDGET = 3000

const TICKET_LIST_MAX = 8
const TICKET_TITLE_MAX = 80
const NEEDS_ME_LABEL: Record<TmwkNeedsMe, string> = {
  decision: 'Decision',
  stop: 'Stop',
  result: 'Result'
}

export type ContextBlockInput = {
  now: Date
  timeZone: string
  homeHostLabel: string
  effective: TmwkRecord[]
  projectId: string | null
  summary: Pick<TmwkSummary, 'createdAt'> | null
  tickets: TmwkTicketListing[]
  /** The session briefing prints the preference block itself. */
  omitPreferences?: boolean
}

export type ContextBlock = { text: string; partial: boolean }

function formatWhen(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${part('weekday')} ${part('month')} ${part('day')} ${part('year')} ${part('hour')}:${part('minute')} ${part('timeZoneName')} (${timeZone})`
}

export function formatSummaryAge(createdAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(createdAt)) / 60_000))
  if (Number.isNaN(minutes)) {
    return 'unknown age'
  }
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`
}

function renderTicketLines(tickets: TmwkTicketListing[]): string[] {
  const needsMe = orderTickets(tickets.filter((ticket) => ticket.needsMe !== null))
  const labelOf = (ticket: TmwkTicketListing): string =>
    ticket.needsMe === null ? '' : NEEDS_ME_LABEL[ticket.needsMe]
  const running = tickets.filter(
    (ticket) => ticket.needsMe === null && RUNNING_STATUSES.includes(ticket.status)
  ).length
  const count = (kind: TmwkNeedsMe): number => needsMe.filter((t) => t.needsMe === kind).length
  const needs =
    needsMe.length === 0
      ? 'none need you'
      : `${needsMe.length} need you (${count('decision')} decisions, ${count('stop')} stops, ${count('result')} finished unaccepted)`
  const lines = [`Tickets: ${needs}, ${running} running.`]
  for (const ticket of needsMe.slice(0, TICKET_LIST_MAX)) {
    const title =
      ticket.title.length > TICKET_TITLE_MAX
        ? `${ticket.title.slice(0, TICKET_TITLE_MAX - 1)}…`
        : ticket.title
    lines.push(`- ${labelOf(ticket)}: ${title} (${ticket.id})`)
  }
  if (needsMe.length > TICKET_LIST_MAX) {
    lines.push(
      `- and ${needsMe.length - TICKET_LIST_MAX} more: run \`orca tmwk tickets --needs-me\``
    )
  }
  return lines
}

export function renderContextBlock(
  input: ContextBlockInput,
  budget: number = CONTEXT_BLOCK_BUDGET
): ContextBlock {
  const head = [
    'Context',
    `Now: ${formatWhen(input.now, input.timeZone)}`,
    `Home host: ${input.homeHostLabel}`
  ]
  const tail = [
    input.summary
      ? `Working summary saved ${formatSummaryAge(input.summary.createdAt, input.now)}.`
      : 'Working summary: none yet.',
    ...renderTicketLines(input.tickets)
  ]
  const fixed = [...head, ...tail].join('\n').length
  if (input.omitPreferences) {
    return { text: [...head, ...tail].join('\n'), partial: false }
  }
  const preferences = renderPreferenceBriefing(
    input.effective,
    input.projectId,
    Math.max(0, budget - fixed - 1)
  )
  return {
    text: [...head, preferences.text, ...tail].join('\n'),
    partial: preferences.partial
  }
}
