import type {
  AgentReadEntry,
  AgentReadResult
} from '../../../shared/agent-conversations/agent-conversation-contracts'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import { tmwkError } from '../tmwk-error'
import { recordStatus } from './search-tmwk-history'

export type TmwkHistorySource = {
  sourceId: string
  kind: 'preference' | 'note' | 'summary' | 'ticket' | 'session'
  createdAt: string | null
  project: TmwkRecord['project']
  source: string | null
  status: string | null
  body: string
  entries?: AgentReadEntry[]
  limited?: boolean
}

export type HistorySourceReaders = {
  records: () => Promise<TmwkRecord[]>
  summaries: () => Promise<TmwkSummary[]>
  tickets: () => Promise<TmwkTicketListing[]>
  readOrcaSession: (orcaSessionId: string) => Promise<AgentReadResult>
}

function renderEntries(result: AgentReadResult): string {
  const lines = result.entries.map((entry) => {
    if (entry.kind === 'message') {
      return `${entry.role}: ${entry.text}`
    }
    if (entry.kind === 'tool') {
      return `tool ${entry.name}${entry.state ? ` (${entry.state})` : ''}`
    }
    return `${entry.kind}: ${entry.text}`
  })
  return result.limited
    ? [...lines, '(shortened: not the whole conversation)'].join('\n')
    : lines.join('\n')
}

export async function readHistorySource(
  sourceId: string,
  readers: HistorySourceReaders
): Promise<TmwkHistorySource> {
  const [prefix, ...rest] = sourceId.split(':')
  const key = rest.join(':')
  if (prefix === 'pref' || prefix === 'note') {
    const record = (await readers.records()).find(
      (r) => r.id === key && r.kind === (prefix === 'note' ? 'note' : 'preference')
    )
    if (!record) {
      throw tmwkError('unknown_source', `no record ${sourceId}`)
    }
    return {
      sourceId,
      kind: record.kind,
      createdAt: record.createdAt,
      project: record.project,
      source: record.source,
      status: recordStatus(record),
      body: record.text
    }
  }
  if (prefix === 'summary') {
    const summary = (await readers.summaries()).find((s) => s.id === key)
    if (!summary) {
      throw tmwkError('unknown_source', `no summary ${sourceId}`)
    }
    return {
      sourceId,
      kind: 'summary',
      createdAt: summary.createdAt,
      project: null,
      source: `${summary.agent} (${summary.reason})`,
      status: null,
      body: summary.text
    }
  }
  if (prefix === 'ticket') {
    const tickets = await readers.tickets()
    // M3 sourceIds named the Task id.
    const ticket = tickets.find((t) => t.id === key) ?? tickets.find((t) => t.taskId === key)
    if (!ticket) {
      throw tmwkError('unknown_source', `no ticket ${sourceId}`)
    }
    return {
      sourceId,
      kind: 'ticket',
      createdAt: ticket.firstSeenAt,
      project: null,
      source: ticket.owner,
      status: ticket.acceptedAt === null ? ticket.status : `${ticket.status}, accepted`,
      body: [
        ticket.title,
        ...(ticket.question === null ? [] : [`Question: ${ticket.question}`]),
        ...(ticket.failure === null ? [] : [ticket.failure]),
        ...(ticket.result === null ? [] : [`Result: ${ticket.result}`])
      ].join('\n\n')
    }
  }
  if (prefix === 'session' && key.startsWith('orca:') && key.length > 5) {
    let result: AgentReadResult
    try {
      result = await readers.readOrcaSession(key.slice(5))
    } catch (error) {
      throw tmwkError(
        'unknown_source',
        `${sourceId} cannot be read: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    return {
      sourceId,
      kind: 'session',
      createdAt: null,
      project: null,
      source: result.agent,
      status: result.state ?? null,
      body: renderEntries(result),
      entries: result.entries,
      limited: result.limited
    }
  }
  if (prefix === 'session' && key.includes(':')) {
    const [agent] = key.split(':')
    return {
      sourceId,
      kind: 'session',
      createdAt: null,
      project: null,
      source: agent,
      status: null,
      body: `The transcript of this ${agent} session is not available through RPC. Find it with \`orca search\`, or resume it in tmwk.`
    }
  }
  throw tmwkError('unknown_source', `${sourceId} is not a known source id`)
}
