import type {
  TmwkTicketAttempt,
  TmwkTicketAttemptPr,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'

/** How long after an attempt settles a refresh still looks for a PR on its branch. */
const PR_LOOKUP_GRACE_MS = 3 * 24 * 60 * 60 * 1000

export type AttemptLaunch = Pick<TmwkTicketAttempt, 'agent' | 'model' | 'effort'>

/** A PR as the host reports it; `updatedAt` stands in for the merge time. */
export type ObservedPr = Omit<TmwkTicketAttemptPr, 'mergedAt'> & { updatedAt?: string }

/** What a refresh read about one attempt from Orca, beyond its Task. */
export type AttemptFacts = {
  launch?: AttemptLaunch
  repo?: string
  branch?: string
  pr?: ObservedPr
}

/** An attempt a refresh reads facts for, keyed by its dispatch. */
export type FollowedAttempt = {
  dispatchId: string
  /** Read the effective launch from `workerShow`. */
  launch: boolean
  /** Read the repo and branch from `worktree.show`; attach could not. */
  worktreeId?: string
  /** Look up the PR for this repo and branch. */
  review?: { repo: string; branch: string }
}

function isOpen(attempt: TmwkTicketAttempt): boolean {
  return attempt.settledAt === undefined && attempt.outcome === undefined
}

function prIsFinal(pr: TmwkTicketAttemptPr | undefined): boolean {
  return pr?.state === 'merged' || pr?.state === 'closed'
}

/**
 * Live attempts on the home host: open ones, and settled ones whose PR is still open or may still
 * appear. A paired server's attempt keeps what its receipt said; `workerShow` would call the server.
 */
export function attemptsToFollow(
  records: readonly TmwkTicketRecord[],
  now: number
): FollowedAttempt[] {
  return records.flatMap((record) =>
    record.attempts.flatMap((attempt): FollowedAttempt[] => {
      if (!attempt.dispatchId || attempt.host || attempt.outcome === 'failed_start') {
        return []
      }
      const open = isOpen(attempt)
      const settled = attempt.settledAt ? Date.parse(attempt.settledAt) : Number.NaN
      const lookForPr =
        !prIsFinal(attempt.pr) &&
        (open || attempt.pr !== undefined || now - settled < PR_LOOKUP_GRACE_MS)
      const branch = attempt.branch
      const followed: FollowedAttempt = {
        dispatchId: attempt.dispatchId,
        launch: open,
        ...(open && attempt.worktreeId && !branch ? { worktreeId: attempt.worktreeId } : {}),
        ...(lookForPr && attempt.repo && branch ? { review: { repo: attempt.repo, branch } } : {})
      }
      return followed.launch || followed.worktreeId || followed.review ? [followed] : []
    })
  )
}

function mergePr(previous: TmwkTicketAttemptPr | undefined, seen: ObservedPr): TmwkTicketAttemptPr {
  const { updatedAt, ...pr } = seen
  const mergedAt = previous?.mergedAt ?? (pr.state === 'merged' ? updatedAt : undefined)
  return { ...pr, ...(mergedAt ? { mergedAt } : {}) }
}

/** Facts only add or replace; a lookup that found nothing never clears what an earlier one saw. */
export function applyAttemptFacts(
  attempt: TmwkTicketAttempt,
  facts: AttemptFacts | undefined
): TmwkTicketAttempt {
  if (!facts) {
    return attempt
  }
  const { agent, model, effort } = facts.launch ?? {}
  return {
    ...attempt,
    ...(agent ? { agent } : {}),
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {}),
    ...(facts.repo && !attempt.repo ? { repo: facts.repo } : {}),
    ...(facts.branch && !attempt.branch ? { branch: facts.branch } : {}),
    ...(facts.pr ? { pr: mergePr(attempt.pr, facts.pr) } : {})
  }
}
