import { z } from 'zod'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'

const HistoryTurn = z.object({
  page: z.object({
    latestTurn: z.object({ turn: z.object({ state: z.string() }) }).nullish()
  })
})

export async function hasTurnInFlight(
  runtime: OrcaRuntimeService,
  sessionId: string
): Promise<boolean> {
  const history = await createTmwkRpc(runtime)('agentSession.history', {
    sessionId,
    direction: 'tail',
    limit: 1
  }).catch(() => null)
  const parsed = HistoryTurn.safeParse(history)
  return parsed.success && parsed.data.page.latestTurn?.turn.state === 'running'
}
