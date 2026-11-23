import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import type {
  TmwkTicketAttempt,
  TmwkTicketAttemptObserved,
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'
import { applyAttemptFacts, type AttemptFacts } from './attempt-facts'
import type { FollowUp } from './read-follow-ups'
import type { TaskDispatch } from './read-task-dispatches'
import { openForNextAttempt, withoutAcceptance } from './ticket-acceptance'

/** What the orchestration reads show for one Task in Run `main`. */
export type LiveTicket = Pick<
  TmwkTicket,
  'taskId' | 'runId' | 'title' | 'result' | 'completedAt' | 'question' | 'owner'
> & {
  status: TmwkTicketAttemptObserved['status']
  /** Why every owner of a `ready` Task ended before it reported; null otherwise. */
  ownerGone: string | null
}

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
    ...(entry.ownerGone ? { stopReason: entry.ownerGone } : {}),
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
  if (TERMINAL.has(entry.status) || entry.ownerGone) {
    const outcome = entry.status === 'completed' ? 'completed' : 'failed'
    if (attempt.outcome !== outcome) {
      const text = entry.ownerGone ?? entry.result ?? outcome
      events.push({ at: now, kind: 'attempt-settled', text, ...ids })
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

/**
 * The follow-up as the next attempt after `latest`, keeping its host, worktree and launch. An
 * implicit ticket's attempt for the same Task gives its start time and observation.
 */
function followUpAttempt(
  latest: TmwkTicketAttempt,
  followUp: FollowUp,
  absorbed: TmwkTicketAttempt | undefined,
  now: string
) {
  const { host, worktreeId, agent, model, effort, repo, branch } = latest
  const carried = Object.fromEntries(
    Object.entries({ host, worktreeId, agent, model, effort, repo, branch }).filter(
      ([, value]) => value !== undefined
    )
  )
  const attempt: TmwkTicketAttempt = {
    runId: latest.runId,
    taskId: followUp.taskId,
    dispatchId: followUp.dispatchId,
    followUpOf: followUp.followUpOf,
    ...carried,
    startedAt: absorbed?.startedAt ?? now,
    ...(absorbed?.observed ? { observed: absorbed.observed } : {})
  }
  const event: TmwkTicketEvent = {
    at: now,
    kind: 'attempt-started',
    text: `Follow-up of ${followUp.followUpOf}`,
    taskId: followUp.taskId,
    dispatchId: followUp.dispatchId
  }
  return { attempt, event }
}

/**
 * Each follow-up becomes the next attempt of the ticket whose latest attempt it continues, which
 * reopens it like `attach`, until chains are applied too. The implicit ticket an earlier refresh
 * made for an appended Task is absorbed into the ticket that took it.
 */
function withFollowUps(
  records: readonly TmwkTicketRecord[],
  followUps: readonly FollowUp[],
  now: string
): TmwkTicketRecord[] {
  const followed = new Set(followUps.map((followUp) => followUp.taskId))
  const implicit = new Map(
    records.flatMap((record) =>
      record.origin === 'orca' &&
      record.attempts.length === 1 &&
      followed.has(record.attempts[0].taskId ?? '')
        ? [[record.attempts[0].taskId, record] as const]
        : []
    )
  )
  const appended = new Set<string>()
  let current = [...records]
  for (let changed = true; changed;) {
    changed = false
    current = current.map((record) => {
      const latest = record.attempts.at(-1)
      const followUp = followUps.find((candidate) => candidate.followUpOf === latest?.dispatchId)
      if (
        !latest ||
        !followUp ||
        implicit.get(record.attempts[0].taskId) === record ||
        record.attempts.some((attempt) => attempt.dispatchId === followUp.dispatchId)
      ) {
        return record
      }
      changed = true
      appended.add(followUp.taskId)
      const absorbed = implicit.get(followUp.taskId)
      const { attempt, event } = followUpAttempt(latest, followUp, absorbed?.attempts[0], now)
      const opened = openForNextAttempt(record, now)
      return {
        ...opened,
        attempts: [...record.attempts, attempt],
        history: [...opened.history, event, ...(absorbed?.history ?? [])]
      }
    })
  }
  return current.filter((record) => {
    const taskId = record.attempts[0]?.taskId
    return !taskId || implicit.get(taskId) !== record || !appended.has(taskId)
  })
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
    /** Dispatches Orca opened to continue a ticket's settled latest attempt. */
    followUps?: readonly FollowUp[]
    /** Follow-up Tasks a paired server answered for without listing them. */
    gone?: readonly string[]
  }
): TmwkTicketRecord[] {
  const { unreadRunIds, now, facts, dispatches, followUps = [], gone = [] } = options
  const liveByTask = new Map(live.map((entry) => [entry.taskId, entry]))
  const attached = new Set<string>()
  const merged: TmwkTicketRecord[] = []
  for (const record of withFollowUps(records, followUps, now)) {
    const events: TmwkTicketEvent[] = []
    let lost = false
    const latestByTask = new Map(record.attempts.map((attempt, index) => [attempt.taskId, index]))
    const attempts = record.attempts.map((stored, index) => {
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
      // A retry reuses the Task; only its newest attempt follows the Task's status.
      if (attempt.settledAt !== undefined && latestByTask.get(attempt.taskId) !== index) {
        return attempt
      }
      const entry = liveByTask.get(attempt.taskId)
      if (entry) {
        return applyLive(linkDispatch(attempt, dispatches?.get(attempt.taskId)), entry, now, events)
      }
      // A follow-up on a paired server has no Task at home; only its server's read settles it.
      if (
        attempt.settledAt !== undefined ||
        (attempt.followUpOf !== undefined &&
          attempt.host !== undefined &&
          !gone.includes(attempt.taskId)) ||
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
