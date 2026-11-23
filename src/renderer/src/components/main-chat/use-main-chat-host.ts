import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { isRepoHidden } from '../../../../shared/project/catalog/hidden-projects'
import { getRepoIdFromWorktreeId } from '../../../../shared/worktree/id'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'

export const MAIN_HOME_DISPLAY_NAME = 'tmwk main'

export type MainChatTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

/** The hidden project the main home bootstrap adds; null before it exists. */
export function useMainHomeRepoId(): string | null {
  return useAppStore(
    (state) =>
      state.repos.find(
        (candidate) => candidate.displayName === MAIN_HOME_DISPLAY_NAME && isRepoHidden(candidate)
      )?.id ?? null
  )
}

/** The main home's chat tabs and the home host they run on; the target key is null until a tab exists. */
export function useMainChatHost(): { tabs: MainChatTab[]; targetKey: string | null } {
  const repoId = useMainHomeRepoId()
  const tabs = useAppStore(
    useShallow((state) =>
      Object.entries(state.unifiedTabsByWorktree)
        .filter(([worktreeId]) => getRepoIdFromWorktreeId(worktreeId) === repoId)
        .flatMap(([, worktreeTabs]) => worktreeTabs)
        .filter((candidate): candidate is MainChatTab => isStructuredTab(candidate))
    )
  )
  const candidate = tabs[0]
  const owner = useAppStore((state) =>
    candidate ? structuredAgentSessionOwnerForTab(state, candidate) : null
  )
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  const targetKey = target?.kind === 'environment' ? target.environmentId : (target?.kind ?? null)
  return { tabs, targetKey }
}

/** A stable string key back to its target, so effects depend on the key, not the object. */
export function targetForKey(targetKey: string): RuntimeClientTarget {
  return targetKey === 'local'
    ? { kind: 'local' }
    : { kind: 'environment', environmentId: targetKey }
}
