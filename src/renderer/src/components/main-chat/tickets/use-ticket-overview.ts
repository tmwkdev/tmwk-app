import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import { targetForKey } from '../use-main-chat-host'

const OVERVIEW_REFETCH_MS = 30_000

// Bumped after every `tmwk.ticket*` mutation from the renderer, so each mounted overview refetches.
let mutationCount = 0
const mutationListeners = new Set<() => void>()

function subscribeToMutations(listener: () => void): () => void {
  mutationListeners.add(listener)
  return () => mutationListeners.delete(listener)
}

/** Calls a `tmwk.ticket*` mutation on the home host, then refetches the overview whether it succeeded or not. */
export async function callTicketMutation<T>(
  target: RuntimeClientTarget,
  method: `tmwk.ticket${string}`,
  params: unknown
): Promise<T> {
  try {
    return await callRuntimeRpc<T>(target, method, params)
  } finally {
    mutationCount += 1
    for (const listener of mutationListeners) {
      listener()
    }
  }
}

/** Changes after every ticket mutation, so a reader can refetch. */
export function useTicketMutationCount(): number {
  return useSyncExternalStore(subscribeToMutations, () => mutationCount)
}

export type TicketOverview = {
  rows: TicketRowModel[]
  /** The last read failed; `rows` is the last overview. */
  failed: boolean
  lastUpdatedAt: string | null
}

/**
 * `tmwk.ticketOverview` from the home host, refetched on a visible-window timer, when a main-chat
 * turn ends, and after each ticket mutation. Null `targetKey` reads nothing.
 */
export function useTicketOverview(
  targetKey: string | null,
  mainTabIds: readonly string[]
): TicketOverview {
  const [snapshot, setSnapshot] = useState<TicketOverview>({
    rows: [],
    failed: false,
    lastUpdatedAt: null
  })
  const tabKey = mainTabIds.join(',')
  const turnEndedAt = useAppStore((state) => {
    const tabIds = new Set(tabKey.split(','))
    let latest = 0
    for (const [paneKey, entry] of state.agentStatusByPaneKey) {
      const tabId = parsePaneKey(paneKey)?.tabId
      if (entry.turnEndedAt && entry.turnEndedAt > latest && tabId && tabIds.has(tabId)) {
        latest = entry.turnEndedAt
      }
    }
    return latest
  })
  const mutations = useTicketMutationCount()
  useEffect(() => {
    if (!targetKey) {
      return
    }
    const target = targetForKey(targetKey)
    let active = true
    const load = (): void => {
      void callRuntimeRpc<{ rows?: TicketRowModel[] }>(target, 'tmwk.ticketOverview', {})
        .then((result) => {
          if (active) {
            setSnapshot({
              rows: result.rows ?? [],
              failed: false,
              lastUpdatedAt: new Date().toISOString()
            })
          }
        })
        .catch((error: unknown) => {
          console.error('tmwk ticket overview read failed', error)
          if (active) {
            setSnapshot((previous) => ({ ...previous, failed: true }))
          }
        })
    }
    load()
    const stopInterval = installWindowVisibilityInterval({
      run: load,
      intervalMs: OVERVIEW_REFETCH_MS
    })
    return () => {
      active = false
      stopInterval()
    }
  }, [targetKey, turnEndedAt, mutations])
  return snapshot
}
