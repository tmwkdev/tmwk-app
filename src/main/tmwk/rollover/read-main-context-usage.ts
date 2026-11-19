import { isAdmissibleAgentSessionContextUsage } from '../../../shared/agent-session/conversation-context/agent-session-context-usage-schema'
import { selectStructuredAgentContextUsage } from '../../../shared/agent-session/conversation-context/structured-agent-session-context-usage'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

export type MainContextUsage = {
  percentage: number
  usedTokens?: number
  windowTokens?: number
  /** Only a Claude `/context` report carries it. */
  autoCompactAtTokens?: number
}

function currentUsageOf(options: unknown): unknown {
  if (typeof options !== 'object' || options === null || !('contextUsage' in options)) {
    return null
  }
  const { contextUsage } = options
  return typeof contextUsage === 'object' && contextUsage !== null && 'current' in contextUsage
    ? contextUsage.current
    : null
}

/** Reads the session's raw context facts; null when the agent reports none or the shape is unknown. */
export async function readMainContextUsage(
  rpc: TmwkRpc,
  sessionId: string
): Promise<MainContextUsage | null> {
  const current = currentUsageOf(await rpc('agentSession.options', { sessionId }))
  if (!isAdmissibleAgentSessionContextUsage(current)) {
    return null
  }
  const usage = selectStructuredAgentContextUsage([], current)
  if (!usage) {
    return null
  }
  const autoCompactAtTokens =
    current.used?.kind === 'report' ? current.used.autoCompactAtTokens : undefined
  return {
    percentage: usage.percentage,
    usedTokens: usage.usedTokens,
    windowTokens: usage.windowTokens,
    ...(autoCompactAtTokens === undefined ? {} : { autoCompactAtTokens })
  }
}
