import type { CommandHandler } from '../dispatch/dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { callTmwk } from './tmwk-rpc-call'

type HistoryHit = {
  sourceId: string
  kind: string
  title: string
  snippet: string
  createdAt: string
  project: { repoId: string; name: string } | null
  status: string | null
}
type HistorySearchResult = { hits: HistoryHit[]; truncated: boolean; sessionsSearched: boolean }
type HistorySource = {
  sourceId: string
  kind: string
  createdAt: string | null
  project: { repoId: string; name: string } | null
  source: string | null
  status: string | null
  body: string
}

function formatHit(hit: HistoryHit): string {
  const flag = hit.status && hit.status !== 'in effect' ? ` (${hit.status})` : ''
  return `${hit.sourceId}  ${hit.kind}  ${hit.createdAt.slice(0, 10) || '-'}  ${hit.snippet}${flag}`
}

function formatSearch(result: HistorySearchResult): string {
  const lines = result.hits.map(formatHit)
  if (result.hits.length === 0) {
    lines.push('No matches.')
  }
  if (result.truncated) {
    lines.push('More matches exist. Narrow the query or raise --limit.')
  }
  if (!result.sessionsSearched) {
    lines.push('Conversations were not searched (--ticket, or the session index is unavailable).')
  }
  return lines.join('\n')
}

function formatSource(source: HistorySource): string {
  return [
    `kind: ${source.kind}`,
    `created: ${source.createdAt ?? 'unknown'}`,
    `project: ${source.project?.name ?? 'global'}`,
    `source: ${source.source ?? 'none'}`,
    `status: ${source.status ?? 'unknown'}`,
    '',
    source.body
  ].join('\n')
}

export const TMWK_HISTORY_HANDLERS: Record<string, CommandHandler> = {
  'tmwk history search': async ({ flags, client, json }) => {
    const project = getOptionalStringFlag(flags, 'project')
    const ticket = getOptionalStringFlag(flags, 'ticket')
    const limit = getOptionalPositiveIntegerFlag(flags, 'limit')
    const response = await callTmwk<HistorySearchResult>(client, 'tmwk.historySearch', {
      query: getRequiredStringFlag(flags, 'query'),
      ...(project === undefined ? {} : { project }),
      ...(ticket === undefined ? {} : { ticket }),
      ...(limit === undefined ? {} : { limit })
    })
    printResult(response, json, formatSearch)
  },
  'tmwk history read': async ({ flags, client, json }) => {
    const response = await callTmwk<HistorySource>(client, 'tmwk.historyRead', {
      sourceId: getRequiredStringFlag(flags, 'sourceId')
    })
    printResult(response, json, formatSource)
  }
}
