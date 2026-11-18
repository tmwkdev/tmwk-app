import { z } from 'zod'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

const LatestTurn = z.object({
  page: z.object({
    latestTurn: z
      .object({
        observedAt: z.number(),
        turn: z.object({
          userItemId: z.string().optional(),
          requestedAt: z.number().optional(),
          startedAt: z.number().optional()
        })
      })
      .nullish()
  })
})

const TriggerItem = z.object({
  item: z
    .object({
      body: z.object({
        kind: z.string(),
        role: z.string().optional(),
        from: z.unknown().optional(),
        blocks: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional()
      })
    })
    .nullable()
})

/** The `[tmwk]` prefix marks a notice that fell back to a user-role message (send-main-notice.ts). */
const NOTICE_PREFIX = '[tmwk]'

/**
 * Epoch ms at which the latest turn of the session started, when a person's message opened it;
 * null for a turn opened by mail, a tmwk notice or provider output. `prompt` events do not fire for user sends.
 */
export async function readUserTurnStart(rpc: TmwkRpc, sessionId: string): Promise<number | null> {
  const history = LatestTurn.safeParse(
    await rpc('agentSession.history', { sessionId, direction: 'tail', limit: 1 })
  )
  const latest = history.success ? history.data.page.latestTurn : null
  if (!latest?.turn.userItemId) {
    return null
  }
  const trigger = TriggerItem.safeParse(
    await rpc('agentSession.item', { sessionId, itemId: latest.turn.userItemId })
  )
  const body = trigger.success ? trigger.data.item?.body : undefined
  if (body?.kind !== 'message' || body.role !== 'user' || body.from !== undefined) {
    return null
  }
  const text = body.blocks?.find((block) => block.type === 'text')?.text ?? ''
  if (text.startsWith(NOTICE_PREFIX)) {
    return null
  }
  return latest.turn.requestedAt ?? latest.turn.startedAt ?? latest.observedAt
}
