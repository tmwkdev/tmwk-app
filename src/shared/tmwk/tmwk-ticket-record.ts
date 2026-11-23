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
  /** Why the owner stopped before reporting, when Orca put the Task back to ready. */
  stopReason: z.string().optional(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string()
})

/** `lost`: the Task left Orca unfinished (its Run was reset or retired). */
const AttemptOutcome = z.enum(['completed', 'failed', 'failed_start', 'lost'])

export const PR_STATES = ['open', 'draft', 'closed', 'merged'] as const

/** The PR (or MR) a refresh found for the attempt's branch; followed until merged or closed. */
const AttemptPr = z.object({
  number: z.number().int().positive(),
  url: z.string(),
  state: z.enum(PR_STATES),
  /** The review's `updatedAt` when a refresh first saw it merged; hosts report no merge time. */
  mergedAt: z.string().optional()
})

/** One Orca Task and Dispatch. A failed start may lack a Task or Dispatch. */
const TicketAttempt = z.object({
  runId: z.string().optional(),
  taskId: z.string().optional(),
  dispatchId: z.string().optional(),
  retryOf: z.string().optional(),
  /** The dispatch this one continues: Orca reopened a finished owner as a new dispatch. */
  followUpOf: z.string().optional(),
  /** As started (the receipt's effective launch, else the requested one); a refresh replaces them with Orca's effective values. */
  agent: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  /** The paired server it was placed on; absent means the home host. */
  host: z.string().optional(),
  worktreeId: z.string().optional(),
  /** The owner's agent terminal; a paired server's comes from a refresh's read there. */
  terminalHandle: z.string().optional(),
  /** The worktree's Orca repo id (tmwk's project id) and branch, read at attach so they outlive the worktree. */
  repo: z.string().optional(),
  branch: z.string().optional(),
  pr: AttemptPr.optional(),
  startedAt: z.string(),
  /** Orca's Task `completed_at` when it settled; the refresh time for a lost attempt or a failed start. */
  settledAt: z.string().optional(),
  outcome: AttemptOutcome.optional(),
  failedStage: z.string().optional(),
  failureReason: z.string().optional(),
  observed: AttemptObserved.optional()
})

/** The external issue a ticket came from; absent means impromptu. */
export const TmwkTicketSourceSchema = z.object({
  kind: z.enum(['linear', 'jira', 'github']),
  /** `ENG-123` for Linear and Jira, `owner/repo#12` for GitHub. */
  key: z.string(),
  url: z.string(),
  title: z.string().optional()
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
  'migrated',
  'answered',
  'message'
])

/**
 * How words the user sent from the ticket reached Orca (D60, D61). `partner`: as the pinned
 * partner session (`gateResolve`, `reply`); `notice`: a notice the partner acts on; `send`:
 * `orchestration.send` to the owner.
 */
const TicketDelivery = z.object({
  status: z.enum(['delivered', 'failed']),
  via: z.enum(['partner', 'notice', 'send']).optional(),
  error: z.string().optional(),
  at: z.string()
})

/**
 * Append-only, except an answer's or message's `delivery`, which a retry updates. `text` is short;
 * ids name the attempt, question or decision the event is about.
 */
const TicketEvent = z.object({
  /** Set on answers and messages, so a retry names them. */
  id: z.string().optional(),
  at: z.string(),
  kind: TicketEventKind,
  text: z.string(),
  taskId: z.string().optional(),
  dispatchId: z.string().optional(),
  questionId: z.string().optional(),
  briefId: z.string().optional(),
  decisionKind: z.enum(['ask', 'gate', 'question']).optional(),
  decisionId: z.string().optional(),
  delivery: TicketDelivery.optional()
})

/** A worktree accept still has to remove, on its attempt's host (absent: the home host). */
const PendingWorktreeCleanup = z.object({
  worktreeId: z.string(),
  host: z.string().optional(),
  /** Tries that left it in place; the next waits until `nextAttemptAt`. */
  failures: z.number().int().positive().optional(),
  nextAttemptAt: z.string().optional()
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
  source: TmwkTicketSourceSchema.optional(),
  /** `orca`: created from an unattached Task in Run `main` (or a v1 snapshot), not by tmwk. */
  origin: z.enum(['tmwk', 'orca']),
  attempts: z.array(TicketAttempt),
  question: TicketQuestion.optional(),
  history: z.array(TicketEvent),
  acceptedAt: z.string().optional(),
  /** Set at accept; a refresh retries each until removed. Absent on tickets accepted before cleanup existed. */
  pendingWorktreeCleanup: z.array(PendingWorktreeCleanup).optional(),
  createdAt: z.string(),
  /** The store version at which an observable field last changed. */
  changedAt: z.number().int().nonnegative()
})

export type TmwkTicketRecord = z.infer<typeof TmwkTicketRecordSchema>
export type TmwkTicketAttempt = z.infer<typeof TicketAttempt>
export type TmwkTicketAttemptObserved = z.infer<typeof AttemptObserved>
export type TmwkTicketAttemptOutcome = z.infer<typeof AttemptOutcome>
export type TmwkTicketEvent = z.infer<typeof TicketEvent>
export type TmwkTicketSource = z.infer<typeof TmwkTicketSourceSchema>
export type TmwkTicketAttemptPr = z.infer<typeof AttemptPr>
export type TmwkTicketDelivery = z.infer<typeof TicketDelivery>
export type TmwkPendingWorktreeCleanup = z.infer<typeof PendingWorktreeCleanup>

/** What `tmwk.ticketCreate`, `ticketAttach`, `ticketAsk` and `ticketShow` return. */
export type TmwkTicketShow = {
  version: number
  ticket: TmwkTicketRecord
  listing: TmwkTicketListing
}

/** What `tmwk.ticketRequest` returns: the requested ticket, and whether Chat got its notice. */
export type TmwkTicketRequestResult = TmwkTicketShow & {
  delivery: { via: 'mail' | 'send' } | { failed: string }
}

/** What `tmwk.ticketAnswer` and `tmwk.ticketMessage` return. */
export type TmwkTicketDeliveryResult = TmwkTicketShow & { delivery: TmwkTicketDelivery }

export function isTmwkTicketRecord(value: unknown): value is TmwkTicketRecord {
  return TmwkTicketRecordSchema.safeParse(value).success
}
