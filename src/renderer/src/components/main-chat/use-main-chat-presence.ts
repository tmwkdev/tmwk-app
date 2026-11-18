import { useEffect } from 'react'
import { isOrcaWindowForegroundFocused } from '@/attention/orca-window-foreground-focus'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'

const PRESENCE_REPORT_MS = 60_000

/** Tells the home host the user is looking at the main chat; the host turns a long gap into the away message. */
export function useMainChatPresence(target: RuntimeClientTarget): void {
  const targetKey = target.kind === 'environment' ? target.environmentId : target.kind
  useEffect(() => {
    const hostTarget: RuntimeClientTarget =
      targetKey === 'local' ? { kind: 'local' } : { kind: 'environment', environmentId: targetKey }
    const report = (): void => {
      if (!isOrcaWindowForegroundFocused()) {
        return
      }
      void callRuntimeRpc(hostTarget, 'tmwk.presence.report', { visible: true }).catch(() => {})
    }
    const stopInterval = installWindowVisibilityInterval({
      run: report,
      intervalMs: PRESENCE_REPORT_MS
    })
    window.addEventListener('focus', report)
    return () => {
      stopInterval()
      window.removeEventListener('focus', report)
    }
  }, [targetKey])
}
