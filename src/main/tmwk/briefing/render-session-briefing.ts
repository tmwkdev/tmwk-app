import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import { renderContextBlock, type ContextBlock } from './render-context-block'
import { PREFERENCE_BRIEFING_BUDGET, renderPreferenceBriefing } from './render-preference-briefing'

export const SESSION_BRIEFING_BUDGET = 9000

export const RUN_USE_LINE =
  'Before any other orchestration command, bind Run `main` with `orca orchestration run-use --id main`.'

export const STALE_SUMMARY_LINE =
  'The working summary may be stale: the latest refresh did not finish. Check recent history before relying on it.'

export const SUMMARY_TRUNCATED_LINE = '(summary shortened to fit)'

export type SessionBriefingInput = {
  summary: TmwkSummary | null
  staleSummary?: boolean
  now: Date
  timeZone: string
  homeHostLabel: string
  effective: TmwkRecord[]
  projectId: string | null
  tickets: TmwkTicket[]
}

function summaryBlock(
  summary: TmwkSummary | null,
  budget: number
): { text: string; partial: boolean } {
  if (!summary) {
    return { text: 'Working summary: none yet.', partial: false }
  }
  const heading = `Working summary (saved ${summary.createdAt.slice(0, 16).replace('T', ' ')} UTC by ${summary.agent})`
  const room = budget - heading.length - SUMMARY_TRUNCATED_LINE.length - 2
  if (summary.text.length <= budget - heading.length - 1) {
    return { text: `${heading}\n${summary.text}`, partial: false }
  }
  const cut = summary.text.slice(0, Math.max(0, room))
  const boundary = cut.lastIndexOf('\n')
  const kept = boundary > room / 2 ? cut.slice(0, boundary) : cut
  return { text: `${heading}\n${kept}\n${SUMMARY_TRUNCATED_LINE}`, partial: true }
}

export function renderSessionBriefing(
  input: SessionBriefingInput,
  budget: number = SESSION_BRIEFING_BUDGET
): ContextBlock {
  const context = renderContextBlock({
    now: input.now,
    timeZone: input.timeZone,
    homeHostLabel: input.homeHostLabel,
    effective: input.effective,
    projectId: input.projectId,
    summary: input.summary,
    tickets: input.tickets,
    omitPreferences: true
  })
  const preferences = renderPreferenceBriefing(
    input.effective,
    input.projectId,
    Math.min(PREFERENCE_BRIEFING_BUDGET, Math.max(0, Math.floor(budget / 3)))
  )
  const fixedLines = [
    preferences.text,
    context.text,
    RUN_USE_LINE,
    ...(input.staleSummary ? [STALE_SUMMARY_LINE] : [])
  ]
  const fixed = fixedLines.join('\n\n').length + 2
  const summary = summaryBlock(input.summary, Math.max(0, budget - fixed))
  return {
    text: [summary.text, ...fixedLines].join('\n\n'),
    partial: summary.partial || preferences.partial
  }
}
