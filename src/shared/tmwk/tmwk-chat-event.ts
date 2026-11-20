import { z } from 'zod'

/** The mail sender tmwk's notices use; only its mail can render as a tmwk event. */
export const TMWK_NOTICE_SENDER = 'tmwk'

const TicketRequestEvent = z.object({
  tmwk: z.literal('ticket-request'),
  ticketId: z.string(),
  title: z.string(),
  words: z.string(),
  project: z.object({ repoId: z.string(), name: z.string() }).optional(),
  /** `auto`, or the paired server `ticket start --host` takes. */
  runOn: z.string().optional(),
  /** What the sheet showed for Run on, such as "Local Mac" or "mbp". */
  runOnLabel: z.string().optional(),
  agent: z.string().optional(),
  source: z.string().optional(),
  requestedAt: z.string()
})

const TicketLine = z.object({
  kind: z.enum(['brief', 'delegated', 'failed']),
  text: z.string(),
  at: z.string(),
  /** On a delegated line: the attempt's agent and paired server, absent for the home host. */
  agent: z.string().optional(),
  host: z.string().optional()
})

/** tmwk's own record of what happened to a ticket (D59), so "Delegated" is confirmed state. */
const TicketLinesEvent = z.object({
  tmwk: z.literal('ticket-lines'),
  ticketId: z.string(),
  lines: z.array(TicketLine).min(1)
})

export const TmwkChatEventSchema = z.discriminatedUnion('tmwk', [
  TicketRequestEvent,
  TicketLinesEvent
])

export type TmwkChatEvent = z.infer<typeof TmwkChatEventSchema>
export type TmwkTicketRequestEvent = z.infer<typeof TicketRequestEvent>
export type TmwkTicketLinesEvent = z.infer<typeof TicketLinesEvent>
export type TmwkTicketLine = z.infer<typeof TicketLine>

/** A notice payload as tmwk wrote it, or null for anything else. */
export function parseTmwkChatEvent(payload: string): TmwkChatEvent | null {
  try {
    const parsed = TmwkChatEventSchema.safeParse(JSON.parse(payload))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
