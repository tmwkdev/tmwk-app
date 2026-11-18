import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import { renderPreferenceBriefing } from './render-preference-briefing'

export const CONTEXT_BLOCK_BUDGET = 3000

export type ContextBlockInput = {
  now: Date
  timeZone: string
  homeHostLabel: string
  effective: TmwkRecord[]
  projectId: string | null
  summary: Pick<TmwkSummary, 'createdAt'> | null
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
    'Tickets: not tracked yet.'
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
