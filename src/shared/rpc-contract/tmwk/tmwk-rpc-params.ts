import { z } from 'zod'
import {
  OptionalBoolean,
  OptionalPositiveInt,
  OptionalString,
  requiredString
} from '../rpc-param-primitives'
import { TmwkTicketSourceSchema } from '../../tmwk/tmwk-ticket-record'

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

export const TmwkTicketOverviewParams = z.object({})

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
    agent: OptionalString,
    /** The external issue the ticket came from; omit for an impromptu ticket. */
    source: TmwkTicketSourceSchema.optional()
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
  model: OptionalString,
  effort: OptionalString,
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

export const TmwkTicketViewParams = z.object({
  ticket: requiredString('Missing ticket id')
})

/** Stops the open attempt's owner and its helpers. */
export const TmwkTicketStopParams = z.object({
  ticket: requiredString('Missing ticket id')
})

/** D60: answers the ticket's open decision. `retry` delivers that answer event again. */
export const TmwkTicketAnswerParams = z
  .object({
    ticket: requiredString('Missing ticket id'),
    answer: OptionalString,
    /** The decision id the answer is for; a different open decision refuses it. */
    decision: OptionalString,
    retry: OptionalString,
    /** Hand the answer to the partner as a notice instead (D61 "Send through Chat"). */
    throughChat: OptionalBoolean
  })
  .refine((params) => params.retry !== undefined || Boolean(params.answer?.trim()), {
    message: 'Missing answer',
    path: ['answer']
  })

/** D60: a message to the open attempt's owner. `retry` delivers that message event again. */
export const TmwkTicketMessageParams = z
  .object({
    ticket: requiredString('Missing ticket id'),
    text: OptionalString,
    retry: OptionalString,
    throughChat: OptionalBoolean
  })
  .refine((params) => params.retry !== undefined || Boolean(params.text?.trim()), {
    message: 'Missing text',
    path: ['text']
  })

export const TmwkTicketAskParams = z.object({
  ticket: requiredString('Missing ticket id'),
  question: requiredString('Missing --question'),
  recommend: OptionalString
})

/** New ticket (D58). With `ticket`, posts the request notice again for that requested ticket. */
export const TmwkTicketRequestParams = z
  .object({
    ticket: OptionalString,
    words: OptionalString,
    project: OptionalString,
    runOn: OptionalString,
    runOnLabel: OptionalString,
    agent: OptionalString,
    source: OptionalString
  })
  .refine((params) => params.ticket !== undefined || Boolean(params.words?.trim()), {
    message: 'Missing words',
    path: ['words']
  })

export const TmwkPresenceReportParams = z.object({
  visible: z.boolean()
})
