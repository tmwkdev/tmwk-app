import { useEffect, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { MainSessionState } from '../../../../shared/tmwk/main-session-switch'
import { targetForKey, useMainChatHost } from './use-main-chat-host'

const PENDING_REFETCH_MS = 2_000

export function useMainChatSession() {
  const { tabs, targetKey } = useMainChatHost()
  const tabIds = tabs.map((tab) => tab.entityId).join(',')
  const [session, setSession] = useState<MainSessionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPending = session?.pending != null
  useEffect(() => {
    if (!targetKey) {
      return
    }
    let active = true
    const hostTarget = targetForKey(targetKey)
    const refetch = (): void => {
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
    }
    refetch()
    const stopPolling = isPending
      ? installWindowVisibilityInterval({ run: refetch, intervalMs: PENDING_REFETCH_MS })
      : undefined
    return () => {
      active = false
      stopPolling?.()
    }
  }, [targetKey, tabIds, isPending])
  const tab = tabs.find((entry) => entry.entityId === session?.pin?.sessionId)
  return {
    tab,
    agents: session?.agents ?? [],
    previousSessionId: session?.pin?.previous?.[0]?.sessionId ?? null,
    pending: session?.pending ?? null,
    lastFailure: session?.lastFailure ?? null,
    error,
    setSession
  }
}
