import { z } from 'zod'

export const TmwkMainSessionGetParams = z.object({}).strict()
export const TmwkMainSessionSwitchParams = z
  .object({
    agent: z.string().min(1),
    expectedSessionId: z.string().min(1)
  })
  .strict()
