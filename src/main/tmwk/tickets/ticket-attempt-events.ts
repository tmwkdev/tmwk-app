import type {
  TmwkTicketAttempt,
  TmwkTicketEvent,
  TmwkTicketSource
} from '../../../shared/tmwk/tmwk-ticket-record'

/**
 * One attempt as `ticket start` or `retry` reports it, from the workerStart receipt, plus what
 * `ticketAttach` read of its worktree. `source` is the worktree's issue link, for the ticket.
 */
export type TicketAttemptInput = Pick<
  TmwkTicketAttempt,
  | 'runId'
  | 'taskId'
  | 'dispatchId'
  | 'retryOf'
  | 'agent'
  | 'model'
  | 'effort'
  | 'host'
  | 'worktreeId'
  | 'repo'
  | 'branch'
  | 'failedStage'
  | 'failureReason'
> & { failedStart?: boolean; briefId?: string; source?: TmwkTicketSource }

/** The history lines an attached attempt adds: its brief, then the delegation or failed start. */
export function attemptEvents(
  attempt: TmwkTicketAttempt,
  input: TicketAttemptInput,
  now: string
): TmwkTicketEvent[] {
  const ids = {
    ...(attempt.taskId ? { taskId: attempt.taskId } : {}),
    ...(attempt.dispatchId ? { dispatchId: attempt.dispatchId } : {})
  }
  const brief: TmwkTicketEvent[] = input.briefId
    ? [{ at: now, kind: 'brief', text: 'Brief ready', briefId: input.briefId }]
    : []
  const stage = attempt.failedStage ? ` at ${attempt.failedStage}` : ''
  const started: TmwkTicketEvent = input.failedStart
    ? {
        at: now,
        kind: 'attempt-failed',
        text: `Couldn't start${stage}: ${attempt.failureReason ?? 'no reason given'}`,
        ...ids
      }
    : {
        at: now,
        kind: 'attempt-started',
        text: `Delegated to ${attempt.agent ?? 'an owner'} on ${attempt.host ?? 'the home host'}`,
        ...ids
      }
  return [...brief, started]
}
