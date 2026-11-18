import type { AgentReadResult } from '../../../shared/agent-conversations/agent-conversation-contracts'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { tmwkError } from '../tmwk-error'
import { recordStatus } from './search-tmwk-history'

export type TmwkHistorySource = {
  sourceId: string
  kind: 'preference' | 'note' | 'session'
  createdAt: string | null
  project: TmwkRecord['project']
  source: string | null
  status: string | null
  body: string
}

export type HistorySourceReaders = {
  records: () => Promise<TmwkRecord[]>
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
      body: renderEntries(result)
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
      body: `The transcript of this ${agent} session is not available through RPC. Find it with \`orca search\`, or resume it in Orca.`
    }
  }
  throw tmwkError('unknown_source', `${sourceId} is not a known source id`)
}
