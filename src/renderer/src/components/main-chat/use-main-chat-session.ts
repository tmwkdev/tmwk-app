import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { isRepoHidden } from '../../../../shared/project/catalog/hidden-projects'
import { getRepoIdFromWorktreeId } from '../../../../shared/worktree/id'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'

export const MAIN_HOME_DISPLAY_NAME = 'tmwk main'

export type MainChatTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

export type MainChatSession = { status: 'preparing' } | { status: 'ready'; tab: MainChatTab }

// Why: the host registers the main home as a hidden folder repo named 'tmwk main'; the renderer cannot compute ~/.tmwk.
export function useMainChatSession(): MainChatSession {
  const repoId = useAppStore(
    (state) =>
      state.repos.find(
        (candidate) => candidate.displayName === MAIN_HOME_DISPLAY_NAME && isRepoHidden(candidate)
      )?.id ?? null
  )
  const tabsByWorktree = useAppStore((state) => state.unifiedTabsByWorktree)
  return useMemo(() => {
    if (!repoId) {
      return { status: 'preparing' }
    }
    const tab = Object.entries(tabsByWorktree)
      .filter(([worktreeId]) => getRepoIdFromWorktreeId(worktreeId) === repoId)
      .flatMap(([, worktreeTabs]) => worktreeTabs)
      .find((candidate): candidate is MainChatTab => isStructuredTab(candidate))
    return tab ? { status: 'ready', tab } : { status: 'preparing' }
  }, [repoId, tabsByWorktree])
}
