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
