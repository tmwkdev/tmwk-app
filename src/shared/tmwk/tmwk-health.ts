import { z } from 'zod'

export const TMWK_FAILURE_KINDS = ['rollover', 'summary', 'main-session', 'ticket-refresh'] as const
export type TmwkFailureKind = (typeof TMWK_FAILURE_KINDS)[number]

/** How the summary stood when the old session was replaced. */
export const TMWK_ROLLOVER_SUMMARIES = ['stored', 'fallback', 'stale'] as const

const HealthFailure = z.object({
  type: z.literal('failure'),
  kind: z.enum(TMWK_FAILURE_KINDS),
  /** Where inside the job it failed, e.g. `create` or `brief` for a main session. */
  stage: z.string(),
  message: z.string(),
  /** A `tmwk_<code>` prefix from `tmwkError`, kept apart so counts can group by it. */
  code: z.string().optional(),
  at: z.string(),
  /** A failure that repeats the newest one is folded into it; `at` is the latest. */
  repeats: z.number().int().positive()
})

const HealthRollover = z.object({
  type: z.literal('rollover'),
  summary: z.enum(TMWK_ROLLOVER_SUMMARIES),
  at: z.string()
})

export const TmwkHealthEventSchema = z.discriminatedUnion('type', [HealthFailure, HealthRollover])
export type TmwkHealthEvent = z.infer<typeof TmwkHealthEventSchema>
export type TmwkHealthFailure = z.infer<typeof HealthFailure>
export type TmwkHealthRollover = z.infer<typeof HealthRollover>

export type TmwkTicketOutcomeCounts = {
  completed: number
  failed: number
  lost: number
  /** Tickets with an attempt still running, at read time. */
  open: number
}

/** `tmwk.health`: what tmwk recorded on this machine. Counts from it go out as tmwk's PostHog events; failure text never does. */
export type TmwkHealthView = {
  windowDays: number
  /** Newest first. */
  failures: TmwkHealthFailure[]
  rollovers: Record<(typeof TMWK_ROLLOVER_SUMMARIES)[number], number>
  tickets: TmwkTicketOutcomeCounts
}
