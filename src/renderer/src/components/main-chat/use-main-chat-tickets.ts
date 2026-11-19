import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { isTmwkTicket, type TmwkTicket } from '../../../../shared/tmwk/tmwk-tickets'

const TICKET_REFETCH_MS = 30_000

/** Ticket snapshots from the home host, refetched on a visible-window timer, on the pinned chat's turn end, and by `refetch`. */
export function useMainChatTickets(
  target: RuntimeClientTarget,
  tabId: string
): {
  tickets: TmwkTicket[]
  failed: boolean
  refetch: () => void
} {
  const targetKey = target.kind === 'environment' ? target.environmentId : target.kind
  const [snapshot, setSnapshot] = useState<{ tickets: TmwkTicket[]; failed: boolean }>({
    tickets: [],
    failed: false
  })
  const turnEndedAt = useAppStore((state) => {
    let latest = 0
    for (const [paneKey, entry] of state.agentStatusByPaneKey) {
      if (
        entry.turnEndedAt &&
        entry.turnEndedAt > latest &&
        parsePaneKey(paneKey)?.tabId === tabId
      ) {
        latest = entry.turnEndedAt
      }
    }
    return latest
  })
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => setAttempt((value) => value + 1), [])
  useEffect(() => {
    const hostTarget: RuntimeClientTarget =
      targetKey === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: targetKey }
    let active = true
    const load = (): void => {
      void callRuntimeRpc<{ tickets?: unknown[] }>(hostTarget, 'tmwk.tickets', {})
        .then((result) => {
          if (active) {
            setSnapshot({ tickets: (result.tickets ?? []).filter(isTmwkTicket), failed: false })
          }
        })
        .catch((error: unknown) => {
          console.error('tmwk tickets read failed', error)
          if (active) {
            setSnapshot((previous) => ({ ...previous, failed: true }))
          }
        })
    }
    load()
    const stopInterval = installWindowVisibilityInterval({
      run: load,
      intervalMs: TICKET_REFETCH_MS
    })
    return () => {
      active = false
      stopInterval()
    }
  }, [targetKey, attempt, turnEndedAt])
  return { ...snapshot, refetch }
}
