import { z } from 'zod'
import {
  OptionalBoolean,
  OptionalPositiveInt,
  OptionalString,
  requiredString
} from '../rpc-param-primitives'

export const TmwkPreferenceSetParams = z.object({
  text: requiredString('Missing preference text'),
  project: OptionalString,
  supersedes: OptionalString
})

export const TmwkPreferenceListParams = z.object({
  project: OptionalString,
  history: OptionalBoolean
})

export const TmwkPreferenceRemoveParams = z.object({
  id: requiredString('Missing preference id')
})

export const TmwkNoteSaveParams = z.object({
  text: requiredString('Missing note text'),
  project: OptionalString,
  source: OptionalString
})

export const TmwkHistorySearchParams = z.object({
  query: requiredString('Missing search query'),
  project: OptionalString,
  ticket: OptionalString,
  limit: OptionalPositiveInt
})

export const TmwkHistoryReadParams = z.object({
  sourceId: requiredString('Missing source id')
})

export const TmwkBriefParams = z.object({
  goal: requiredString('Missing goal'),
  words: OptionalString,
  project: OptionalString,
  evidence: z.array(z.string().min(1)).max(20).optional()
})

export const TmwkSummaryWriteParams = z.object({
  text: requiredString('Missing summary text')
})

export const TmwkSummaryShowParams = z.object({
  history: OptionalBoolean
})

export const TmwkTicketsParams = z.object({
  needsMe: OptionalBoolean,
  since: OptionalPositiveInt
})

/** `taskId` takes a ticket id or, as in M3, the Task id of one of its attempts. */
export const TmwkTicketAcceptParams = z.object({
  taskId: requiredString('Missing ticket id')
})

/** With `ticket`, revises that ticket (requested, or with no running attempt) for its next start. */
export const TmwkTicketCreateParams = z
  .object({
    ticket: OptionalString,
    words: OptionalString,
    title: OptionalString,
    goal: OptionalString,
    project: OptionalString,
    kind: z.literal('ongoing').optional(),
    runOn: OptionalString,
    agent: OptionalString
  })
  .refine((params) => params.ticket !== undefined || params.words !== undefined, {
    message: 'Missing --words',
    path: ['words']
  })

/** One attempt from a workerStart receipt; `failedStart` records a start that did not reach a worker. */
export const TmwkTicketAttachParams = z.object({
  ticket: requiredString('Missing ticket id'),
  runId: OptionalString,
  taskId: OptionalString,
  dispatchId: OptionalString,
  retryOf: OptionalString,
  agent: OptionalString,
  host: OptionalString,
  worktreeId: OptionalString,
  failedStart: OptionalBoolean,
  failedStage: OptionalString,
  failureReason: OptionalString,
  briefId: OptionalString
})

export const TmwkTicketShowParams = z.object({
  ticket: requiredString('Missing ticket id')
})

export const TmwkTicketAskParams = z.object({
  ticket: requiredString('Missing ticket id'),
  question: requiredString('Missing --question'),
  recommend: OptionalString
})

export const TmwkPresenceReportParams = z.object({
  visible: z.boolean()
})
