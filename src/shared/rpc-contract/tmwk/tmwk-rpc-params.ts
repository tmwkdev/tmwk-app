import { z } from 'zod'
import { OptionalBoolean, OptionalString, requiredString } from '../rpc-param-primitives'

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
