import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import type {
  TmwkTicketAttempt,
  TmwkTicketAttemptObserved,
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'
import { applyAttemptFacts, type AttemptFacts } from './attempt-facts'
import type { TaskDispatch } from './read-task-dispatches'
import { withoutAcceptance } from './ticket-acceptance'

/** What the orchestration reads show for one Task in Run `main`. */
export type LiveTicket = Pick<
  TmwkTicket,
  'taskId' | 'runId' | 'title' | 'result' | 'completedAt' | 'question' | 'owner'
> & { status: TmwkTicketAttemptObserved['status'] }

const TERMINAL: ReadonlySet<string> = new Set(['completed', 'failed'])

function observe(
  previous: TmwkTicketAttemptObserved | undefined,
  entry: LiveTicket,
  now: string
): TmwkTicketAttemptObserved {
  return {
    title: entry.title,
    status: entry.status,
    result: entry.result,
    completedAt: entry.completedAt,
    question: entry.question,
    owner: entry.owner,
    firstSeenAt: previous?.firstSeenAt ?? now,
    lastSeenAt: now
  }
}

function outcomeKey(attempt: TmwkTicketAttempt | undefined): string {
  const seen = attempt?.observed
  return JSON.stringify([attempt?.outcome, seen?.status, seen?.result, seen?.completedAt])
}

/** A live entry settles its attempt when the Task finished, and reopens it when Orca reopened the Task. */
function applyLive(
  attempt: TmwkTicketAttempt,
  entry: LiveTicket,
  now: string,
  events: TmwkTicketEvent[]
): TmwkTicketAttempt {
  const observed = observe(attempt.observed, entry, now)
  const ids = {
    taskId: entry.taskId,
    ...(attempt.dispatchId ? { dispatchId: attempt.dispatchId } : {})
  }
  if (TERMINAL.has(entry.status)) {
    const outcome = entry.status === 'completed' ? 'completed' : 'failed'
    if (attempt.outcome !== outcome) {
      events.push({ at: now, kind: 'attempt-settled', text: entry.result ?? outcome, ...ids })
    }
    // Orca's completion time, not this refresh's: a refresh can run hours after the Task settled.
    const settledAt = attempt.settledAt ?? entry.completedAt ?? now
    return { ...attempt, observed, outcome, settledAt }
  }
  const { settledAt, outcome, ...open } = attempt
  if (settledAt !== undefined || outcome !== undefined) {
    events.push({ at: now, kind: 'attempt-reopened', text: entry.status, ...ids })
  }
  return { ...open, observed }
}

/** An attempt with no dispatch takes the one Orca recorded for its Task; one it has is never replaced. */
function linkDispatch(
  attempt: TmwkTicketAttempt,
  dispatch: TaskDispatch | undefined
): TmwkTicketAttempt {
  if (attempt.dispatchId || !dispatch) {
    return attempt
  }
  return { ...dispatch, ...attempt, dispatchId: dispatch.dispatchId }
}

function implicitTicket(
  entry: LiveTicket,
  id: string,
  now: string,
  dispatch: TaskDispatch | undefined
): TmwkTicketRecord {
  const events: TmwkTicketEvent[] = [
    { at: now, kind: 'attempt-started', text: 'Found in Run main', taskId: entry.taskId }
  ]
  const attempt = applyLive(
    linkDispatch({ runId: entry.runId, taskId: entry.taskId, startedAt: now }, dispatch),
    entry,
    now,
    events
  )
  return {
    id,
    title: entry.title,
    words: '',
    status: 'active',
    origin: 'orca',
    attempts: [attempt],
    history: events,
    createdAt: now,
    changedAt: 0
  }
}

/**
 * Folds the live Tasks of Run `main` into the records. A Task no attempt names becomes a ticket of
 * origin `orca`. An open attempt whose Task is gone (outside `unreadRunIds`) is `lost`; a ticket
 * tmwk only found in Orca is dropped instead, as M3 dropped its snapshot. A failed start never
 * reads live state: its Task, if any, was never dispatched.
 */
export function mergeLiveTasks(
  records: readonly TmwkTicketRecord[],
  live: readonly LiveTicket[],
  options: {
    unreadRunIds: readonly string[]
    now: string
    newId: () => string
    /** What a refresh read of each followed attempt, by dispatch id. */
    facts?: ReadonlyMap<string, AttemptFacts>
    /** Orca's owner dispatch for each live Task no attempt links to yet, by task id. */
    dispatches?: ReadonlyMap<string, TaskDispatch>
  }
): TmwkTicketRecord[] {
  const { unreadRunIds, now, facts, dispatches } = options
  const liveByTask = new Map(live.map((entry) => [entry.taskId, entry]))
  const attached = new Set<string>()
  const merged: TmwkTicketRecord[] = []
  for (const record of records) {
    const events: TmwkTicketEvent[] = []
    let lost = false
    const attempts = record.attempts.map((stored) => {
      const attempt = stored.dispatchId
        ? applyAttemptFacts(stored, facts?.get(stored.dispatchId))
        : stored
      if (attempt.taskId === undefined) {
        return attempt
      }
      attached.add(attempt.taskId)
      if (attempt.outcome === 'failed_start') {
        return attempt
      }
      const entry = liveByTask.get(attempt.taskId)
      if (entry) {
        return applyLive(linkDispatch(attempt, dispatches?.get(attempt.taskId)), entry, now, events)
      }
      if (
        attempt.settledAt !== undefined ||
        (attempt.runId !== undefined && unreadRunIds.includes(attempt.runId))
      ) {
        return attempt
      }
      lost = true
      events.push({
        at: now,
        kind: 'attempt-lost',
        text: 'Task gone from Orca',
        taskId: attempt.taskId
      })
      return { ...attempt, settledAt: now, outcome: 'lost' as const }
    })
    if (lost && record.origin === 'orca' && record.attempts.length === 1) {
      continue
    }
    const reopened =
      record.status === 'accepted' &&
      outcomeKey(record.attempts.at(-1)) !== outcomeKey(attempts.at(-1))
    const latestTitle = attempts.at(-1)?.observed?.title
    merged.push({
      ...(reopened ? withoutAcceptance(record) : record),
      ...(record.origin === 'orca' && latestTitle ? { title: latestTitle } : {}),
      ...(reopened ? { status: 'active' as const } : {}),
      attempts,
      history: events.length > 0 ? [...record.history, ...events] : record.history
    })
  }
  for (const entry of live) {
    if (!attached.has(entry.taskId)) {
      merged.push(implicitTicket(entry, options.newId(), now, dispatches?.get(entry.taskId)))
    }
  }
  return merged
}
