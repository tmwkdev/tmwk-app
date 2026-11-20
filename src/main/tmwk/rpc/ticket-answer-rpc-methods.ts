import type { z } from 'zod'
import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkTicketAnswerParams,
  TmwkTicketMessageParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TicketDecision } from '../../../shared/tmwk/ticket-view'
import type {
  TmwkTicketDeliveryResult,
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import {
  deliverAnswer,
  deliverMessage,
  type TicketDeliveryDeps
} from '../tickets/deliver-ticket-words'
import { readTicketDecision } from '../tickets/read-ticket-decision'
import { readTicketFleet } from '../tickets/read-ticket-fleet'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { partnerRpc, postMainNotice } from '../tickets/ticket-chat-notices'
import { isOpenAttempt } from '../tickets/ticket-listing'
import type { TicketStore } from '../tickets/ticket-store'
import { appendSentWords, askedEventFor, recordDelivery } from '../tickets/ticket-sent-words'
import { tmwkError } from '../tmwk-error'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export type TicketWordsDeps = {
  store: TicketStore
  readDecision: (ticket: TmwkTicketRecord) => Promise<TicketDecision | null>
  ownerHandle: (ticket: TmwkTicketRecord) => Promise<string | null>
  delivery: TicketDeliveryDeps
}

function findEvent(
  ticket: TmwkTicketRecord,
  eventId: string,
  kind: TmwkTicketEvent['kind']
): TmwkTicketEvent {
  const event = ticket.history.find((candidate) => candidate.id === eventId)
  if (!event || event.kind !== kind) {
    throw tmwkError('unknown_event', `${ticket.id} has no ${kind} event ${eventId}`)
  }
  if (event.delivery?.status === 'delivered') {
    throw tmwkError('already_delivered', `${eventId} was already delivered.`)
  }
  return event
}

/**
 * D60, D61: the answer joins the ticket's history first, then is delivered; the delivery, or why
 * it failed, is recorded on that event. A retry delivers the same event again.
 */
export async function answerTicket(
  params: z.output<typeof TmwkTicketAnswerParams>,
  deps: TicketWordsDeps
): Promise<TmwkTicketDeliveryResult> {
  const { ticket } = await deps.store.show(params.ticket)
  const decision = await deps.readDecision(ticket)
  const retried = params.retry ? findEvent(ticket, params.retry, 'answered') : null
  const decisionId = retried?.decisionId ?? params.decision
  if (!decision || (decisionId !== undefined && decision.id !== decisionId)) {
    throw tmwkError('decision_closed', `${ticket.id} no longer waits on that decision.`)
  }
  const answer = retried?.text ?? params.answer ?? ''
  const event =
    retried ??
    (await appendSentWords(
      deps.store,
      ticket.id,
      {
        kind: 'answered',
        text: answer,
        decisionKind: decision.kind,
        decisionId: decision.id
      },
      askedEventFor(ticket, decision)
    ))
  const delivery = await deliverAnswer(deps.delivery, ticket, decision, answer, {
    throughChat: params.throughChat
  })
  const shown = await recordDelivery(
    deps.store,
    ticket.id,
    event.id ?? '',
    delivery,
    decision.kind === 'ask' && delivery.status === 'delivered' ? decision.id : undefined
  )
  return { ...shown, delivery }
}

/** D60: a message to the open attempt's owner, recorded in history, then sent. */
export async function messageTicket(
  params: z.output<typeof TmwkTicketMessageParams>,
  deps: TicketWordsDeps
): Promise<TmwkTicketDeliveryResult> {
  const { ticket } = await deps.store.show(params.ticket)
  if (!ticket.attempts.some(isOpenAttempt)) {
    throw tmwkError('ticket_not_running', `${ticket.id} has no running owner to message.`)
  }
  const retried = params.retry ? findEvent(ticket, params.retry, 'message') : null
  const text = retried?.text ?? params.text ?? ''
  const event = retried ?? (await appendSentWords(deps.store, ticket.id, { kind: 'message', text }))
  const delivery = await deliverMessage(
    deps.delivery,
    ticket,
    await deps.ownerHandle(ticket),
    text,
    {
      throughChat: params.throughChat
    }
  )
  const shown = await recordDelivery(deps.store, ticket.id, event.id ?? '', delivery)
  return { ...shown, delivery }
}

function wordsDeps(runtime: OrcaRuntimeService): TicketWordsDeps {
  const rpc = createTmwkRpc(runtime)
  return {
    store: openTmwkTicketStore(),
    readDecision: (ticket) => readTicketDecision(rpc, ticket),
    ownerHandle: async (ticket) => {
      const open = ticket.attempts.findLast(isOpenAttempt)
      const fleet = open?.dispatchId ? await readTicketFleet(rpc, [ticket]) : null
      return (open?.dispatchId && fleet?.workers.get(open.dispatchId)?.terminalHandle) || null
    },
    delivery: {
      rpc,
      asPartner: partnerRpc(runtime),
      notify: (notice) => postMainNotice(runtime, notice)
    }
  }
}

export const TICKET_ANSWER_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.ticketAnswer',
    permission: 'workspace',
    params: TmwkTicketAnswerParams,
    handler: async (params, { runtime }): Promise<TmwkTicketDeliveryResult> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      const result = await answerTicket(params, wordsDeps(runtime))
      if (result.delivery.status === 'delivered') {
        await refreshTicketSnapshots(runtime)
        void requestSummaryRefresh(runtime, { reason: 'ticket' })
      }
      return result
    }
  }),
  defineMethod({
    name: 'tmwk.ticketMessage',
    permission: 'workspace',
    params: TmwkTicketMessageParams,
    handler: async (params, { runtime }): Promise<TmwkTicketDeliveryResult> => {
      requireTmwkHomeHost()
      return messageTicket(params, wordsDeps(runtime))
    }
  })
]
