import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { onMainTurn } from '../rollover/main-session-turns'
import { readMainContextUsage } from '../rollover/read-main-context-usage'
import { requestSummaryRefresh } from './refresh-working-summary'

const REFRESH_AT_PERCENT = 50

/** Requests a refresh each time the pinned session's context usage rises through 50%. */
export function startContextRefreshTrigger(runtime: OrcaRuntimeService): void {
  const above = new Map<string, boolean>()
  onMainTurn(runtime, (event) => {
    if (event.type !== 'completion') {
      return
    }
    const sessionId = event.pinnedSessionId
    void readMainContextUsage(createTmwkRpc(runtime), sessionId)
      .then((usage) => {
        if (!usage) {
          return
        }
        const isAbove = usage.percentage >= REFRESH_AT_PERCENT
        if (isAbove && !above.get(sessionId)) {
          above.set(sessionId, true)
          void requestSummaryRefresh(runtime, { reason: 'context-50' }).then((result) => {
            if (
              result.outcome === 'failed' ||
              (result.outcome === 'skipped' && !result.unchanged)
            ) {
              above.set(sessionId, false)
            }
          })
          return
        }
        above.set(sessionId, isAbove)
      })
      .catch((error: unknown) => console.error('[tmwk] context usage read failed:', error))
  })
}
