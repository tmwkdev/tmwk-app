import type { CommandHandler } from '../dispatch/dispatch'
import { readTextOrFileFlag } from '../arguments/command-body-input'
import { printResult } from '../output/command-result-output'
import type { TmwkSummary } from '../../shared/tmwk/tmwk-summaries'
import { callTmwk } from './tmwk-rpc-call'

type SummaryShowResult = { summary: TmwkSummary | null } | { summaries: TmwkSummary[] }

function formatHeading(summary: TmwkSummary): string {
  return `${summary.id}  ${summary.createdAt.slice(0, 16).replace('T', ' ')} UTC  ${summary.agent}  ${summary.reason}`
}

function formatSummary(summary: TmwkSummary): string {
  return `${formatHeading(summary)}\n\n${summary.text}`
}

function formatShow(result: SummaryShowResult): string {
  if ('summaries' in result) {
    return result.summaries.length === 0
      ? 'No summaries yet.'
      : result.summaries.map(formatHeading).join('\n')
  }
  return result.summary ? formatSummary(result.summary) : 'No summaries yet.'
}

export const TMWK_SUMMARY_HANDLERS: Record<string, CommandHandler> = {
  'tmwk summary write': async ({ flags, client, cwd, json }) => {
    const text = await readTextOrFileFlag(flags, cwd, 'text', true)
    const response = await callTmwk<{ summary: TmwkSummary }>(client, 'tmwk.summaryWrite', {
      text
    })
    printResult(response, json, (result) => `Saved ${result.summary.id}.`)
  },
  'tmwk summary show': async ({ flags, client, json }) => {
    const response = await callTmwk<SummaryShowResult>(client, 'tmwk.summaryShow', {
      history: flags.get('history') === true
    })
    printResult(response, json, formatShow)
  }
}
