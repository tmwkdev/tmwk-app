import { z } from 'zod'
import { OptionalBoolean, OptionalString } from '../rpc-param-primitives'

export const TmwkPreferenceListParams = z.object({
  project: OptionalString,
  history: OptionalBoolean
})
