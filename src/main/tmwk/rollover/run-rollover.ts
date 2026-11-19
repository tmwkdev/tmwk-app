import type {
  MainSessionEndReason,
  MainSessionRecord
} from '../../../shared/tmwk/main-session-record'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { MainHome } from '../main-home/ensure-main-home'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { setPendingMainSessionPhase } from '../main-session/pending-main-session-change'
import { replaceMainSession } from '../main-session/replace-main-session'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import { tmwkError } from '../tmwk-error'
import { storeFallbackSummary } from './fallback-summary'
import { readMainContextUsage } from './read-main-context-usage'
import { decideRollover, ROLLOVER_CEILING_PERCENT } from './rollover-decision'
import { runStandingRulesFlush } from './standing-rules-flush'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'

export type RolloverRun = {
  runtime: OrcaRuntimeService
  home: MainHome
  sessionId: string
  agent: string
  reason: MainSessionEndReason
  /** Set for the usage-triggered path, which may decide to keep the old session. A switch or manual rollover always proceeds. */
  automatic?: { usagePercent: number; thresholdPercent: number }
}

const refreshFailures = new WeakMap<OrcaRuntimeService, number>()
const briefingTurns = new WeakMap<OrcaRuntimeService, Set<string>>()

/** True once for a session that was just briefed, so the turn the briefing starts cannot trigger another rollover. */
export function consumeBriefingTurn(runtime: OrcaRuntimeService, sessionId: string): boolean {
  return briefingTurns.get(runtime)?.delete(sessionId) ?? false
}

function rememberBriefingTurn(runtime: OrcaRuntimeService, sessionId: string): void {
  const sessions = briefingTurns.get(runtime) ?? new Set<string>()
  sessions.add(sessionId)
  briefingTurns.set(runtime, sessions)
}

/** Flush and refresh side by side, then brief and replace. Returns null when an automatic run keeps the old session. Runs inside `runMainSessionOperation`. */
export async function runRollover(input: RolloverRun): Promise<MainSessionRecord | null> {
  const { runtime, home, sessionId, agent, reason, automatic } = input
  const rpc = createTmwkRpc(runtime)
  const current = await readMainSessionPin(home.paths.sessionRecord)
  if (current?.sessionId !== sessionId) {
    throw tmwkError('session_changed', 'The main chat changed before the new session started.')
  }
  const usagePercent =
    automatic?.usagePercent ??
    (await readMainContextUsage(rpc, sessionId).catch(() => null))?.percentage ??
    null
  const [flush, refresh] = await Promise.all([
    runStandingRulesFlush(runtime, rpc, sessionId),
    requestSummaryRefresh(runtime, { force: true, reason })
  ])
  const stored =
    refresh.outcome === 'stored' || (refresh.outcome === 'skipped' && refresh.unchanged)
  let refreshLabel: string = stored ? 'stored' : 'failed'
  let staleSummary = !stored
  if (automatic) {
    const failures = stored ? 0 : (refreshFailures.get(runtime) ?? 0) + 1
    refreshFailures.set(runtime, failures)
    const decision = decideRollover({
      usagePercent,
      thresholdPercent: automatic.thresholdPercent,
      ceilingPercent: ROLLOVER_CEILING_PERCENT,
      awaitingUser: false,
      refresh: stored ? 'stored' : 'failed',
      refreshFailures: failures
    })
    if (decision !== 'roll-over' && decision !== 'roll-over-with-fallback') {
      console.error(
        `[tmwk] rollover kept old=${sessionId} usage=${usagePercent ?? 'n/a'} refresh=${refreshLabel} failures=${failures} flush=${flush}`
      )
      return null
    }
    if (decision === 'roll-over-with-fallback') {
      await storeFallbackSummary(rpc, current).catch((error: unknown) =>
        console.error('[tmwk] fallback summary not stored:', error)
      )
      refreshLabel = 'fallback'
    }
  }
  setPendingMainSessionPhase(runtime, 'starting')
  const next = await replaceMainSession({
    rpc,
    home,
    current,
    agent,
    reason,
    staleSummary,
    refreshTickets: () => refreshTicketSnapshots(runtime),
    onBriefing: (newSessionId) => rememberBriefingTurn(runtime, newSessionId)
  })
  refreshFailures.delete(runtime)
  console.error(
    `[tmwk] rollover old=${sessionId} new=${next.sessionId} agent=${agent} reason=${reason} usage=${usagePercent ?? 'n/a'} refresh=${refreshLabel} flush=${flush}`
  )
  return next
}
