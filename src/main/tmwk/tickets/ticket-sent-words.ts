import { randomBytes } from 'node:crypto'
import type { TicketDecision } from '../../../shared/tmwk/ticket-view'
import type {
  TmwkTicketDelivery,
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'
import type { TicketShow, TicketStore } from './ticket-store'

/** Appends the user's answer or message, with the event id a retry names it by (W5). */
export async function appendSentWords(
  store: TicketStore,
  idOrTaskId: string,
  input: Omit<TmwkTicketEvent, 'at' | 'id'>,
  before: TmwkTicketEvent[] = []
): Promise<TmwkTicketEvent> {
  const event = {
    ...input,
    id: `ev_${randomBytes(4).toString('hex')}`,
    at: new Date().toISOString()
  }
  await store.revise(idOrTaskId, (record) => ({
    ...record,
    history: [...record.history, ...before, event]
  }))
  return event
}

/** The question an answer resolves, when only Orca holds it (a gate or a worker question), so the thread keeps it above the answer. */
export function askedEventFor(
  record: TmwkTicketRecord,
  decision: TicketDecision
): TmwkTicketEvent[] {
  const recorded = record.history.some(
    (event) =>
      event.kind === 'asked' &&
      (event.questionId === decision.id || event.decisionId === decision.id)
  )
  if (recorded) {
    return []
  }
  return [
    {
      at: decision.askedAt ?? new Date().toISOString(),
      kind: 'asked',
      text: decision.text,
      decisionKind: decision.kind,
      decisionId: decision.id
    }
  ]
}

/** Records an event's delivery; a delivered answer to the open `ticket ask` closes that question. */
export function recordDelivery(
  store: TicketStore,
  idOrTaskId: string,
  eventId: string,
  delivery: TmwkTicketDelivery,
  closeQuestion?: string
): Promise<TicketShow> {
  return store.revise(idOrTaskId, (record, now) =>
    withDelivery(record, eventId, delivery, closeQuestion, now)
  )
}

function withDelivery(
  record: TmwkTicketRecord,
  eventId: string,
  delivery: TmwkTicketDelivery,
  closeQuestion: string | undefined,
  now: string
): TmwkTicketRecord {
  const history = record.history.map((event) =>
    event.id === eventId ? { ...event, delivery } : event
  )
  if (closeQuestion === undefined || record.question?.id !== closeQuestion) {
    return { ...record, history }
  }
  const { question: _question, ...rest } = record
  const closed: TmwkTicketEvent = {
    at: now,
    kind: 'question-closed',
    text: 'Answered',
    questionId: closeQuestion
  }
  return { ...rest, history: [...history, closed] }
}
