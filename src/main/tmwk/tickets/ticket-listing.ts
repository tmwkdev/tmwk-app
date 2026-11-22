import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { tmwkError } from '../tmwk-error'
import { classifyNeedsMe } from '../../../shared/tmwk/ticket-overview/ticket-state'

export function isOpenAttempt(attempt: TmwkTicketAttempt | undefined): boolean {
  return attempt !== undefined && attempt.settledAt === undefined && attempt.outcome === undefined
}

function failureOf(attempt: TmwkTicketAttempt | undefined): string | null {
  if (attempt?.outcome === 'failed_start') {
    const stage = attempt.failedStage ? ` at ${attempt.failedStage}` : ''
    return `Couldn't start${stage}: ${attempt.failureReason ?? 'no reason given'}`
  }
  if (attempt?.outcome === 'lost') {
    return 'Its Orca task is gone before it finished.'
  }
  return null
}

/** The record as `tmwk.tickets` lists it; needs-me comes from the ticket's question and its latest attempt. */
export function listTicket(record: TmwkTicketRecord): TmwkTicketListing {
  const latest = record.attempts.at(-1)
  const observed = latest?.observed
  const failure = failureOf(latest)
  const status =
    latest === undefined ? 'requested' : failure ? 'failed' : (observed?.status ?? 'pending')
  const acceptedAt = record.acceptedAt ?? null
  // Acceptance settles the owner's question too; only the partner's own ask reopens it.
  const openQuestion =
    acceptedAt === null && latest?.settledAt === undefined ? (observed?.question ?? null) : null
  const question = record.question?.text ?? openQuestion
  return {
    id: record.id,
    taskId: latest?.taskId ?? null,
    runId: latest?.runId ?? null,
    title: record.title,
    status,
    result: observed?.result ?? null,
    completedAt: observed?.completedAt ?? null,
    firstSeenAt: record.createdAt,
    lastSeenAt: observed?.lastSeenAt ?? record.createdAt,
    acceptedAt,
    changedAt: record.changedAt,
    needsMe: classifyNeedsMe({ status, question, acceptedAt }),
    question,
    owner: observed?.owner ?? null,
    ticketStatus: record.status,
    kind: record.kind ?? null,
    attempts: record.attempts.length,
    dispatchId: latest?.dispatchId ?? null,
    host: latest?.host ?? null,
    agent: latest?.agent ?? record.agent ?? null,
    model: latest?.model ?? null,
    effort: latest?.effort ?? null,
    repo: latest?.repo ?? null,
    branch: latest?.branch ?? null,
    pr: latest?.pr ?? null,
    source: record.source ?? null,
    failure
  }
}

/** A ticket by its id, or by the Task id of any of its attempts (M3 callers pass task ids). */
export function findTicket(
  records: readonly TmwkTicketRecord[],
  idOrTaskId: string
): TmwkTicketRecord {
  const found =
    records.find((record) => record.id === idOrTaskId) ??
    records.find((record) => record.attempts.some((attempt) => attempt.taskId === idOrTaskId))
  if (!found) {
    throw tmwkError('unknown_ticket', `no ticket ${idOrTaskId}`)
  }
  return found
}
