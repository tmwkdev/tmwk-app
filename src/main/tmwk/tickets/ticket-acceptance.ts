import type {
  TmwkPendingWorktreeCleanup,
  TmwkTicketAttempt,
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'

function pendingWorktreesOf(attempts: readonly TmwkTicketAttempt[]): TmwkPendingWorktreeCleanup[] {
  const pending: TmwkPendingWorktreeCleanup[] = []
  for (const { worktreeId, host } of attempts) {
    const entry = { worktreeId: worktreeId ?? '', ...(host ? { host } : {}) }
    if (worktreeId && !pending.some((seen) => sameWorktree(seen, entry))) {
      pending.push(entry)
    }
  }
  return pending
}

/** The ticket accepted at `acceptedAt`, with every attempt's worktree marked for cleanup on its own host. */
export function acceptRecord(record: TmwkTicketRecord, acceptedAt: string): TmwkTicketRecord {
  const pending = pendingWorktreesOf(record.attempts)
  return {
    ...record,
    status: 'accepted',
    acceptedAt,
    ...(pending.length > 0 ? { pendingWorktreeCleanup: pending } : {}),
    history: [...record.history, { at: acceptedAt, kind: 'accepted', text: 'Accepted' }]
  }
}

/** A reopened ticket is no longer accepted, so its worktrees are no longer due for cleanup. */
export function withoutAcceptance(record: TmwkTicketRecord): TmwkTicketRecord {
  const { acceptedAt: _acceptedAt, pendingWorktreeCleanup: _pending, ...rest } = record
  return rest
}

/** A new attempt reopens the ticket and closes the question it was waiting on. */
export function openForNextAttempt(record: TmwkTicketRecord, now: string): TmwkTicketRecord {
  const closed: TmwkTicketEvent[] = record.question
    ? [
        {
          at: now,
          kind: 'question-closed',
          text: 'Closed by the next attempt',
          questionId: record.question.id
        }
      ]
    : []
  const { question: _question, ...rest } = withoutAcceptance(record)
  return { ...rest, status: 'active', history: [...record.history, ...closed] }
}

const BACKOFF_START_MS = 60_000
const BACKOFF_MAX_MS = 60 * 60_000

/** One try at a pending worktree: removed (or gone), or still in place. */
export type WorktreeCleanupOutcome = { entry: TmwkPendingWorktreeCleanup; removed: boolean }

export function sameWorktree(
  a: TmwkPendingWorktreeCleanup,
  b: TmwkPendingWorktreeCleanup
): boolean {
  return a.worktreeId === b.worktreeId && a.host === b.host
}

/** Drops removed worktrees and backs off the rest (1 min doubling to 1 h); only an accepted ticket has any. */
export function settlePendingWorktrees(
  record: TmwkTicketRecord,
  outcomes: readonly WorktreeCleanupOutcome[],
  now: number
): TmwkTicketRecord {
  if (record.status !== 'accepted' || !record.pendingWorktreeCleanup) {
    return record
  }
  const { pendingWorktreeCleanup, ...rest } = record
  const left = pendingWorktreeCleanup.flatMap((entry) => {
    const outcome = outcomes.find((tried) => sameWorktree(tried.entry, entry))
    if (!outcome) {
      return [entry]
    }
    if (outcome.removed) {
      return []
    }
    const failures = (entry.failures ?? 0) + 1
    const delay = Math.min(BACKOFF_START_MS * 2 ** (failures - 1), BACKOFF_MAX_MS)
    return [{ ...entry, failures, nextAttemptAt: new Date(now + delay).toISOString() }]
  })
  return left.length > 0 ? { ...rest, pendingWorktreeCleanup: left } : rest
}
