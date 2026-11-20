import { useEffect, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { TmwkHealthView } from '../../../../../shared/tmwk/tmwk-health'

const HEALTH_REFETCH_MS = 60_000

export type TmwkHealthSnapshot = {
  view: TmwkHealthView | null
  /** The last read failed; `view` is the one before it. */
  failed: boolean
}

/** `tmwk.health` from the home host: on mount, each time the panel opens, and on a visible-window timer. */
export function useTmwkHealth(target: RuntimeClientTarget, open: boolean): TmwkHealthSnapshot {
  const [snapshot, setSnapshot] = useState<TmwkHealthSnapshot>({ view: null, failed: false })
  useEffect(() => {
    let active = true
    const load = (): void => {
      void callRuntimeRpc<TmwkHealthView>(target, 'tmwk.health', {})
        .then((view) => active && setSnapshot({ view, failed: false }))
        .catch((error: unknown) => {
          console.error('tmwk health read failed', error)
          if (active) {
            setSnapshot((previous) => ({ ...previous, failed: true }))
          }
        })
    }
    load()
    const stop = installWindowVisibilityInterval({ run: load, intervalMs: HEALTH_REFETCH_MS })
    return () => {
      active = false
      stop()
    }
  }, [target, open])
  return snapshot
}
