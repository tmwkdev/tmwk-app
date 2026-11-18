import type { TmwkRpc } from './tmwk-runtime-rpc'

type AgentSessionTab = { type: 'agent-session'; sessionId: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function agentSessionTabs(listing: unknown): AgentSessionTab[] {
  if (!isRecord(listing) || !Array.isArray(listing.tabs)) {
    return []
  }
  const tabs: AgentSessionTab[] = []
  for (const tab of listing.tabs) {
    if (isRecord(tab) && tab.type === 'agent-session' && typeof tab.sessionId === 'string') {
      tabs.push({ type: 'agent-session', sessionId: tab.sessionId })
    }
  }
  return tabs
}

/** Closes chats in the main home other than the pinned one; returns the closed ids. */
export async function closeStrayMainSessions(
  rpc: TmwkRpc,
  worktreeId: string,
  pinnedSessionId: string
): Promise<string[]> {
  const listing = await rpc('session.tabs.list', { worktree: `id:${worktreeId}` })
  const strays = agentSessionTabs(listing).filter((tab) => tab.sessionId !== pinnedSessionId)
  const closed: string[] = []
  for (const tab of strays) {
    try {
      await rpc('agentSession.close', { sessionId: tab.sessionId })
      closed.push(tab.sessionId)
    } catch (error) {
      console.error('[tmwk] stray main-home session not closed:', error)
    }
  }
  return closed
}
