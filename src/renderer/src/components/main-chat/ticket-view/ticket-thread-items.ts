import { isTuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { TerminalAgent } from '../../../../../shared/agent-status/identity/terminal-agent'
import type { TicketDecision } from '../../../../../shared/tmwk/ticket-view'
import { parseWorkerReport } from '../../../../../shared/tmwk/ticket-overview/worker-report'
import type {
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../../../shared/tmwk/tmwk-ticket-record'

/** One line of the ticket thread: your words, an owner's report, or a quiet event. */
export type TicketThreadItem =
  | { kind: 'you'; key: string; at: string; text: string }
  | { kind: 'report'; key: string; at: string; text: string; detail: string | null }
  | {
      kind: 'event'
      key: string
      at: string
      text: string
      agent: TerminalAgent | null
      failed: boolean
    }

/** Shown below the "earlier events" row; older ones fold under it. */
export const THREAD_TAIL = 6

function agentFor(record: TmwkTicketRecord, event: TmwkTicketEvent): TerminalAgent | null {
  const attempt = record.attempts.find(
    (candidate) =>
      (event.dispatchId !== undefined && candidate.dispatchId === event.dispatchId) ||
      (event.taskId !== undefined && candidate.taskId === event.taskId)
  )
  const agent = attempt?.agent ?? record.agent
  return isTuiAgent(agent) ? agent : null
}

function itemOf(
  record: TmwkTicketRecord,
  event: TmwkTicketEvent,
  key: string
): TicketThreadItem | null {
  switch (event.kind) {
    case 'requested':
      return event.text.trim() ? { kind: 'you', key, at: event.at, text: event.text } : null
    case 'attempt-settled': {
      const report = parseWorkerReport(event.text)
      return {
        kind: 'report',
        key,
        at: event.at,
        text: report?.subject ?? event.text,
        detail: report?.body ?? null
      }
    }
    // The next attempt line says why; the closed question needs no line of its own.
    case 'question-closed':
    case 'migrated':
      return null
    case 'asked':
    case 'brief':
    case 'attempt-started':
    case 'attempt-failed':
    case 'attempt-reopened':
    case 'attempt-lost':
    case 'accepted':
      return {
        kind: 'event',
        key,
        at: event.at,
        text: event.text,
        agent: agentFor(record, event),
        failed: event.kind === 'attempt-failed' || event.kind === 'attempt-lost'
      }
  }
}

/**
 * The record's history as thread items, oldest first. The pending decision is drawn as a card
 * after the thread, so its own `asked` line is left out here.
 */
export function ticketThreadItems(
  record: TmwkTicketRecord,
  decision: TicketDecision | null
): TicketThreadItem[] {
  return record.history.flatMap((event, index) => {
    if (event.kind === 'asked' && decision?.kind === 'ask' && event.questionId === decision.id) {
      return []
    }
    const item = itemOf(record, event, `${index}:${event.kind}`)
    return item ? [item] : []
  })
}
