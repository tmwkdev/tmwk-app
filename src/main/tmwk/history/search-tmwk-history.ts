import type { AiVaultSearchHit } from '../../../shared/ai-vault/search/ai-vault-search-types'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'

export const HISTORY_SEARCH_DEFAULT_LIMIT = 20

export type TmwkHistoryHit = {
  sourceId: string
  kind: 'preference' | 'note' | 'summary' | 'ticket' | 'session'
  title: string
  snippet: string
  createdAt: string
  project: TmwkRecord['project']
  status: 'in effect' | 'replaced' | 'removed' | null
}

const SNIPPET_MAX = 160

function snippetOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX - 1)}…` : flat
}

export function recordStatus(record: TmwkRecord): NonNullable<TmwkHistoryHit['status']> {
  if (record.supersededBy !== null) {
    return 'replaced'
  }
  return record.retiredAt === null ? 'in effect' : 'removed'
}

// Every term must appear in the text or the source, case-insensitively.
export function searchStoreRecords(
  records: TmwkRecord[],
  filter: { query: string; repoId: string | null; ticket?: string }
): TmwkHistoryHit[] {
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  return records
    .filter((record) => {
      if (
        filter.repoId !== null &&
        record.project !== null &&
        record.project.repoId !== filter.repoId
      ) {
        return false
      }
      if (filter.ticket !== undefined && !(record.source ?? '').includes(filter.ticket)) {
        return false
      }
      const haystack = `${record.text} ${record.source ?? ''}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
    .map((record) => ({
      sourceId: `${record.kind === 'note' ? 'note' : 'pref'}:${record.id}`,
      kind: record.kind,
      title: record.kind === 'note' ? 'Note' : 'Preference',
      snippet: snippetOf(record.text),
      createdAt: record.createdAt,
      project: record.project,
      status: recordStatus(record)
    }))
}

// Summaries belong to no project, so a project or ticket filter leaves them out.
export function searchSummaries(
  summaries: TmwkSummary[],
  filter: { query: string; repoId: string | null; ticket?: string }
): TmwkHistoryHit[] {
  if (filter.repoId !== null || filter.ticket !== undefined) {
    return []
  }
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  return summaries
    .filter((summary) => terms.every((term) => summary.text.toLowerCase().includes(term)))
    .map((summary) => ({
      sourceId: `summary:${summary.id}`,
      kind: 'summary',
      title: 'Working summary',
      snippet: snippetOf(summary.text),
      createdAt: summary.createdAt,
      project: null,
      status: null
    }))
}

// Tickets belong to no project; a --ticket filter keeps only the one task id.
export function searchTickets(
  tickets: TmwkTicket[],
  filter: { query: string; repoId: string | null; ticket?: string }
): TmwkHistoryHit[] {
  if (filter.repoId !== null) {
    return []
  }
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  return tickets
    .filter((ticket) => {
      if (filter.ticket !== undefined && ticket.taskId !== filter.ticket) {
        return false
      }
      const haystack =
        `${ticket.title} ${ticket.result ?? ''} ${ticket.question ?? ''}`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
    .map((ticket) => ({
      sourceId: `ticket:${ticket.taskId}`,
      kind: 'ticket',
      title: ticket.title,
      snippet: snippetOf(ticket.result ?? ticket.question ?? ticket.title),
      createdAt: ticket.firstSeenAt,
      project: null,
      status: null
    }))
}

// Structured chats read through agent.read by their Orca id; provider transcripts carry agent and id only.
export function sessionSourceId(hit: AiVaultSearchHit): string {
  return hit.structuredSession
    ? `session:orca:${hit.structuredSession.sessionId}`
    : `session:${hit.agent}:${hit.sessionId}`
}

export function sessionHitToHistoryHit(hit: AiVaultSearchHit): TmwkHistoryHit {
  return {
    sourceId: sessionSourceId(hit),
    kind: 'session',
    title: hit.title,
    snippet: snippetOf(hit.evidence?.snippet ?? hit.title),
    createdAt: hit.updatedAt ?? '',
    project: null,
    status: null
  }
}

export function mergeHistoryHits(
  storeHits: TmwkHistoryHit[],
  sessionHits: TmwkHistoryHit[],
  limit: number
): { hits: TmwkHistoryHit[]; truncated: boolean } {
  const all = [...storeHits, ...sessionHits].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { hits: all.slice(0, limit), truncated: all.length > limit }
}
