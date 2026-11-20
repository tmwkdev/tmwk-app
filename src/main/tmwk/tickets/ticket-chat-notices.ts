import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { TmwkTicketLine, TmwkTicketRequestEvent } from '../../../shared/tmwk/tmwk-chat-event'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { runMainSessionOperation } from '../main-session/main-session-operations'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { sendMainNotice, type MainNotice, type MainNoticeResult } from '../notices/send-main-notice'
import { tmwkError } from '../tmwk-error'

export type TicketRequestDetails = {
  project?: { repoId: string; name: string }
  runOnLabel?: string
  source?: string
}

/** Queued behind any rollover or switch, so the notice reaches the session that is pinned when it sends. */
export function postMainNotice(
  runtime: OrcaRuntimeService,
  notice: MainNotice
): Promise<MainNoticeResult> {
  return runMainSessionOperation(runtime, async () => {
    const pin = await readMainSessionPin(resolveMainHomePaths().sessionRecord)
    if (!pin) {
      throw tmwkError('no_main_session', 'Chat has not started yet.')
    }
    return sendMainNotice(createTmwkRpc(runtime), pin.sessionId, notice)
  })
}

/** The request as the partner reads it: the user's words, then the facts it needs for `ticket start`. */
export function ticketRequestNotice(
  ticket: TmwkTicketRecord,
  details: TicketRequestDetails
): MainNotice {
  const payload: TmwkTicketRequestEvent = {
    tmwk: 'ticket-request',
    ticketId: ticket.id,
    title: ticket.title,
    words: ticket.words,
    ...(details.project ? { project: details.project } : {}),
    ...(ticket.runOn ? { runOn: ticket.runOn } : {}),
    ...(details.runOnLabel ? { runOnLabel: details.runOnLabel } : {}),
    ...(ticket.agent ? { agent: ticket.agent } : {}),
    ...(details.source ? { source: details.source } : {}),
    requestedAt: ticket.createdAt
  }
  const facts = [
    `Ticket: ${ticket.id}`,
    details.project
      ? `Project: ${details.project.name} (--project id:${details.project.repoId})`
      : 'Project: none chosen',
    `Run on: ${details.runOnLabel ?? 'Auto'}${ticket.runOn && ticket.runOn !== 'auto' ? ` (--host ${ticket.runOn})` : ''}`,
    `Agent: ${ticket.agent ?? 'the default'}`,
    ...(details.source ? [`Create from: ${details.source}`] : [])
  ]
  return {
    subject: 'New ticket request',
    body: `${ticket.words}\n\n${facts.join('\n')}`,
    payload
  }
}

/** The brief and delegation lines the latest attach added, or none. */
export function attachedTicketLines(ticket: TmwkTicketRecord): TmwkTicketLine[] {
  const attempt = ticket.attempts.at(-1)
  if (!attempt) {
    return []
  }
  return ticket.history.flatMap((event): TmwkTicketLine[] => {
    if (event.at !== attempt.startedAt) {
      return []
    }
    switch (event.kind) {
      case 'brief':
        return [{ kind: 'brief', text: event.text, at: event.at }]
      case 'attempt-started':
        return [
          {
            kind: 'delegated',
            text: event.text,
            at: event.at,
            ...(attempt.agent ? { agent: attempt.agent } : {}),
            ...(attempt.host ? { host: attempt.host } : {})
          }
        ]
      case 'attempt-failed':
        return [{ kind: 'failed', text: event.text, at: event.at }]
      default:
        return []
    }
  })
}

/** Best effort: a missed system line never fails the attach, and the ticket keeps the history. */
export function postAttachedTicketLines(
  runtime: OrcaRuntimeService,
  ticket: TmwkTicketRecord
): void {
  const lines = attachedTicketLines(ticket)
  if (lines.length === 0) {
    return
  }
  void postMainNotice(runtime, {
    subject: lines.map((line) => line.text).join(' · '),
    body: `Ticket: ${ticket.id}. Recorded by tmwk; no reply needed.`,
    payload: { tmwk: 'ticket-lines', ticketId: ticket.id, lines }
  }).catch((error: unknown) => {
    console.error('[tmwk] ticket system line not posted:', error)
  })
}
