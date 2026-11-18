import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { isRepoHidden } from '../../../../shared/project/catalog/hidden-projects'
import { getRepoIdFromWorktreeId } from '../../../../shared/worktree/id'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'
import type { MainSessionState } from '../../../../shared/tmwk/main-session-switch'

export const MAIN_HOME_DISPLAY_NAME = 'tmwk main'

export type MainChatTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

export function useMainChatSession() {
  const repoId = useAppStore(
    (state) =>
      state.repos.find(
        (candidate) => candidate.displayName === MAIN_HOME_DISPLAY_NAME && isRepoHidden(candidate)
      )?.id ?? null
  )
  const tabsByWorktree = useAppStore((state) => state.unifiedTabsByWorktree)
  const tabs = useMemo(
    () =>
      Object.entries(tabsByWorktree)
        .filter(([worktreeId]) => getRepoIdFromWorktreeId(worktreeId) === repoId)
        .flatMap(([, worktreeTabs]) => worktreeTabs)
        .filter((candidate): candidate is MainChatTab => isStructuredTab(candidate)),
    [repoId, tabsByWorktree]
  )
  const candidate = tabs[0]
  const owner = useAppStore((state) =>
    candidate ? structuredAgentSessionOwnerForTab(state, candidate) : null
  )
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  const targetKey = target?.kind === 'environment' ? target.environmentId : target?.kind
  const tabIds = tabs.map((tab) => tab.entityId).join(',')
  const [session, setSession] = useState<MainSessionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!targetKey) {
      return
    }
    let active = true
    const hostTarget =
      targetKey === 'local'
        ? ({ kind: 'local' } as const)
        : ({ kind: 'environment', environmentId: targetKey } as const)
    void callRuntimeRpc<MainSessionState>(hostTarget, 'tmwk.mainSession.get', {})
      .then((result) => {
        if (active) {
          setSession(result)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Cannot load the main chat.')
        }
      })
    return () => {
      active = false
    }
  }, [targetKey, tabIds])
  const tab = tabs.find((entry) => entry.entityId === session?.pin?.sessionId)
  return { tab, agents: session?.agents ?? [], error, setSession }
}
