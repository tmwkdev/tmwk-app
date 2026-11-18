import { z } from 'zod'

export const TmwkMainSessionGetParams = z.object({}).strict()
export const TmwkMainSessionSwitchParams = z
  .object({
    agent: z.string().min(1),
    expectedSessionId: z.string().min(1)
  })
  .strict()
export const TmwkMainSessionRolloverParams = z
  .object({
    expectedSessionId: z.string().min(1).optional(),
    agent: z.string().min(1).optional()
  })
  .strict()
