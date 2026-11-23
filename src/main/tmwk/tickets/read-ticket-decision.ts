import type { TicketDecision } from '../../../shared/tmwk/ticket-view'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import {
  GateList,
  gateOptions,
  Inbox,
  INBOX_LIMIT,
  pendingAsks,
  readEndedDispatches
} from './read-live-tickets'

/**
 * The decision the ticket waits on, in `listTicket`'s order: the partner's `ticket ask`, then a
 * pending gate on the latest unsettled attempt's Task, then that Task's unanswered question mail.
 */
export async function readTicketDecision(
  rpc: TmwkRpc,
  record: TmwkTicketRecord
): Promise<TicketDecision | null> {
  if (record.question) {
    const { id, text, recommend, askedAt } = record.question
    return { kind: 'ask', id, text, recommend: recommend ?? null, options: [], askedAt }
  }
  const latest = record.attempts.at(-1)
  if (
    record.acceptedAt !== undefined ||
    !latest?.taskId ||
    !latest.runId ||
    latest.settledAt !== undefined
  ) {
    return null
  }
  const { gates } = GateList.parse(
    await rpc('orchestration.gateList', {
      run: latest.runId,
      task: latest.taskId,
      status: 'pending'
    })
  )
  const gate = gates.find((candidate) => candidate.task_id === latest.taskId)
  if (gate) {
    return {
      kind: 'gate',
      id: gate.id,
      text: gate.question,
      recommend: null,
      options: gateOptions(gate.options),
      askedAt: gate.created_at ?? null
    }
  }
  const { messages } = Inbox.parse(
    await rpc('orchestration.inbox', { run: latest.runId, limit: INBOX_LIMIT })
  )
  const ended = await readEndedDispatches(rpc, latest.runId)
  const ask = pendingAsks(messages, ended).get(latest.taskId)
  return ask
    ? {
        kind: 'question',
        id: ask.id,
        text: ask.text,
        recommend: null,
        options: ask.options,
        askedAt: ask.askedAt
      }
    : null
}
