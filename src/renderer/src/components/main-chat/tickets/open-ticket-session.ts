import { useAppStore } from '@/store'
import { activateWorktreeAgentPane } from '@/components/sidebar/workspace-card/activity/use-worktree-agent-activation'
import { activateWorktreeFromSidebar } from '@/lib/workspace/activation/sidebar-worktree-activation'
import { getAgentPaneExecutionHost } from '@/store/slices/agent-status/pane-authority/agent-pane-execution-host'
import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import type { TicketRowSession } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'

export type SessionPane = {
  paneKey: string
  tabId: string
  worktreeId: string
  executionHostId: ExecutionHostId | undefined
  updatedAt: number
}

/** Per terminal handle, the newest pane on a host this window owns whose agent status names it, as M3's activity panel matched owners. */
export function sessionPanesByHandle(
  state: ReturnType<typeof useAppStore.getState>
): Map<string, SessionPane> {
  const panes = new Map<string, SessionPane>()
  for (const [paneKey, entry] of state.agentStatusByPaneKey) {
    const parsed = parsePaneKey(paneKey)
    const handle = entry.terminalHandle
    const newer = handle ? panes.get(handle) : undefined
    if (!handle || !parsed || (newer && entry.updatedAt < newer.updatedAt)) {
      continue
    }
    const host = getAgentPaneExecutionHost(state, paneKey, entry)
    const worktreeId =
      entry.worktreeId ??
      Object.entries(state.tabsByWorktree).find(([, tabs]) =>
        tabs?.some((tab) => tab.id === parsed.tabId)
      )?.[0]
    if (host === 'foreign' || !worktreeId) {
      continue
    }
    panes.set(handle, {
      paneKey,
      tabId: parsed.tabId,
      worktreeId,
      executionHostId: host ?? undefined,
      updatedAt: entry.updatedAt
    })
  }
  return panes
}

/** The host a session's worktree lives on, so a paired server's opens there; undefined is this window's default. */
export function ticketSessionHost(session: TicketRowSession): ExecutionHostId | undefined {
  return parseExecutionHostId(session.executionHostId)?.id
}

/** Opens the session's worktree on its host. */
export function openTicketWorktree(session: TicketRowSession): void {
  if (session.worktreeId) {
    void activateWorktreeFromSidebar(session.worktreeId, ticketSessionHost(session))
  }
}

/** Opens the session's own pane, or its worktree when the pane is not known here. */
export function openTicketSession(session: TicketRowSession): void {
  const pane = session.terminalHandle
    ? sessionPanesByHandle(useAppStore.getState()).get(session.terminalHandle)
    : undefined
  if (pane) {
    activateWorktreeAgentPane(pane.worktreeId, pane.tabId, pane.paneKey, pane.executionHostId)
    return
  }
  openTicketWorktree(session)
}
