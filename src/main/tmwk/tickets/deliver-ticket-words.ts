import type { TicketDecision } from '../../../shared/tmwk/ticket-view'
import type { TmwkTicketDelivery, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { MainNotice, MainNoticeResult } from '../notices/send-main-notice'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

export type TicketDeliveryDeps = {
  /** Calls Orca as the pinned partner session (request evidence, W1 spike 2). */
  asPartner: TmwkRpc
  /** Calls Orca as tmwk itself. */
  rpc: TmwkRpc
  /** A notice to the partner, which delivers it in its next turn. */
  notify: (notice: MainNotice) => Promise<MainNoticeResult>
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const quoted = (text: string): string => JSON.stringify(text)

function delivered(via: TmwkTicketDelivery['via']): TmwkTicketDelivery {
  return { status: 'delivered', via, at: new Date().toISOString() }
}

function failed(error: unknown): TmwkTicketDelivery {
  return { status: 'failed', error: errorText(error), at: new Date().toISOString() }
}

/** The answer as a notice the partner acts on: the exact command for a gate or question. */
export function answerNotice(
  ticket: TmwkTicketRecord,
  decision: TicketDecision,
  answer: string
): MainNotice {
  const command =
    decision.kind === 'gate'
      ? `orca orchestration gate-resolve --id ${decision.id} --resolution ${quoted(answer)}`
      : decision.kind === 'question'
        ? `orca orchestration reply --id ${decision.id} --body ${quoted(answer)}`
        : `orca tmwk ticket start --ticket ${ticket.id} …`
  return {
    subject: 'Answer from the user',
    body: [
      `Ticket: ${ticket.id} (${ticket.title})`,
      `Question: ${decision.text}`,
      `Answer: ${answer}`,
      decision.kind === 'ask'
        ? `Start the ticket with this answer: ${command}`
        : `Deliver it: ${command}`
    ].join('\n')
  }
}

/**
 * D60 as W1 changed it: a gate or worker question is answered as the pinned partner; if Orca
 * refuses that, the answer goes to the partner as a notice. A `ticket ask` is the partner's own
 * question, so its answer always goes to the partner.
 */
export async function deliverAnswer(
  deps: TicketDeliveryDeps,
  ticket: TmwkTicketRecord,
  decision: TicketDecision,
  answer: string,
  { throughChat = false }: { throughChat?: boolean } = {}
): Promise<TmwkTicketDelivery> {
  const runId = ticket.attempts.at(-1)?.runId
  if (!throughChat && decision.kind !== 'ask') {
    try {
      await (decision.kind === 'gate'
        ? deps.asPartner('orchestration.gateResolve', {
            id: decision.id,
            resolution: answer,
            ...(runId ? { run: runId } : {})
          })
        : deps.asPartner('orchestration.reply', {
            id: decision.id,
            body: answer,
            ...(runId ? { run: runId } : {})
          }))
      return delivered('partner')
    } catch (error) {
      console.error(`[tmwk] answer as the partner refused for ${ticket.id}:`, error)
    }
  }
  try {
    await deps.notify(answerNotice(ticket, decision, answer))
    return delivered('notice')
  } catch (error) {
    return failed(error)
  }
}

/** D60: a message goes straight to the open attempt's owner; Send through Chat asks the partner to pass it on. */
export async function deliverMessage(
  deps: TicketDeliveryDeps,
  ticket: TmwkTicketRecord,
  ownerHandle: string | null,
  text: string,
  { throughChat = false }: { throughChat?: boolean } = {}
): Promise<TmwkTicketDelivery> {
  try {
    if (throughChat) {
      await deps.notify({
        subject: 'Message for an owner',
        body: [
          `Ticket: ${ticket.id} (${ticket.title})`,
          `The user wrote to its owner${ownerHandle ? ` (${ownerHandle})` : ''}; it did not arrive directly. Pass it on with orchestration send:`,
          '',
          text
        ].join('\n')
      })
      return delivered('notice')
    }
    if (!ownerHandle) {
      throw new Error('No owner of this ticket is reachable from here.')
    }
    await deps.rpc('orchestration.send', {
      to: ownerHandle,
      from: 'tmwk',
      type: 'status',
      subject: `Message from the user about ${ticket.title}`,
      body: text
    })
    return delivered('send')
  } catch (error) {
    return failed(error)
  }
}
