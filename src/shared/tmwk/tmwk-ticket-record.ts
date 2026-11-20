import { z } from 'zod'
import type { TmwkTicketListing } from './tmwk-tickets'

const TaskStatus = z.enum(['pending', 'ready', 'dispatched', 'completed', 'failed', 'blocked'])

/** What the last refresh saw of the attempt's Orca Task: the M3 snapshot fields. */
const AttemptObserved = z.object({
  title: z.string(),
  status: TaskStatus,
  result: z.string().nullable(),
  completedAt: z.string().nullable(),
  /** The open gate or pending ask the owner is waiting on. */
  question: z.string().nullable(),
  /** The assignee handle while a worker holds the task. */
  owner: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string()
})

/** `lost`: the Task left Orca unfinished (its Run was reset or retired). */
const AttemptOutcome = z.enum(['completed', 'failed', 'failed_start', 'lost'])

/** One Orca Task and Dispatch. A failed start may lack a Task or Dispatch. */
const TicketAttempt = z.object({
  runId: z.string().optional(),
  taskId: z.string().optional(),
  dispatchId: z.string().optional(),
  retryOf: z.string().optional(),
  agent: z.string().optional(),
  /** The paired server it was placed on; absent means the home host. */
  host: z.string().optional(),
  worktreeId: z.string().optional(),
  startedAt: z.string(),
  settledAt: z.string().optional(),
  outcome: AttemptOutcome.optional(),
  failedStage: z.string().optional(),
  failureReason: z.string().optional(),
  observed: AttemptObserved.optional()
})

const TicketQuestion = z.object({
  id: z.string(),
  text: z.string(),
  recommend: z.string().optional(),
  askedAt: z.string()
})

const TicketEventKind = z.enum([
  'requested',
  'brief',
  'attempt-started',
  'attempt-failed',
  'attempt-settled',
  'attempt-reopened',
  'attempt-lost',
  'asked',
  'question-closed',
  'accepted',
  'migrated'
])

/** Append-only. `text` is short; ids name the attempt or question the event is about. */
const TicketEvent = z.object({
  at: z.string(),
  kind: TicketEventKind,
  text: z.string(),
  taskId: z.string().optional(),
  dispatchId: z.string().optional(),
  questionId: z.string().optional(),
  briefId: z.string().optional()
})

export const TmwkTicketRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** The user's request verbatim; empty for tickets tmwk found in Orca. */
  words: z.string(),
  goal: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(['requested', 'active', 'accepted']),
  kind: z.literal('ongoing').optional(),
  runOn: z.string().optional(),
  agent: z.string().optional(),
  /** `orca`: created from an unattached Task in Run `main` (or a v1 snapshot), not by tmwk. */
  origin: z.enum(['tmwk', 'orca']),
  attempts: z.array(TicketAttempt),
  question: TicketQuestion.optional(),
  history: z.array(TicketEvent),
  acceptedAt: z.string().optional(),
  createdAt: z.string(),
  /** The store version at which an observable field last changed. */
  changedAt: z.number().int().nonnegative()
})

export type TmwkTicketRecord = z.infer<typeof TmwkTicketRecordSchema>
export type TmwkTicketAttempt = z.infer<typeof TicketAttempt>
export type TmwkTicketAttemptObserved = z.infer<typeof AttemptObserved>
export type TmwkTicketAttemptOutcome = z.infer<typeof AttemptOutcome>
export type TmwkTicketEvent = z.infer<typeof TicketEvent>

/** What `tmwk.ticketCreate`, `ticketAttach`, `ticketAsk` and `ticketShow` return. */
export type TmwkTicketShow = {
  version: number
  ticket: TmwkTicketRecord
  listing: TmwkTicketListing
}

export function isTmwkTicketRecord(value: unknown): value is TmwkTicketRecord {
  return TmwkTicketRecordSchema.safeParse(value).success
}
