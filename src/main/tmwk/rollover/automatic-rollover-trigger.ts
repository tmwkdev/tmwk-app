import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { recordTmwkFailure } from '../health/record-tmwk-health'
import type { MainHome } from '../main-home/ensure-main-home'
import { runMainSessionOperation } from '../main-session/main-session-operations'
import { readMainSessionPin } from '../main-session/main-session-pin'
import {
  clearPendingMainSessionChange,
  markPendingMainSessionChange,
  readPendingMainSessionChange
} from '../main-session/pending-main-session-change'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { onMainTurn } from './main-session-turns'
import { readMainContextUsage } from './read-main-context-usage'
import { consumeBriefingTurn, runRollover } from './run-rollover'
import {
  decideRollover,
  resolveRolloverThreshold,
  ROLLOVER_CEILING_PERCENT
} from './rollover-decision'

/** Rolls the pinned session over after a completed turn once its context usage reaches the threshold. Acts only on completion events, never while a change is pending. */
export function startAutomaticRollover(runtime: OrcaRuntimeService, home: MainHome): void {
  onMainTurn(runtime, (event) => {
    if (event.type !== 'completion') {
      return
    }
    const sessionId = event.pinnedSessionId
    const awaitingUser = event.completion.awaitingUser === true
    const briefingTurn = consumeBriefingTurn(runtime, sessionId)
    if (briefingTurn || readPendingMainSessionChange(runtime)) {
      return
    }
    void evaluate(runtime, home, sessionId, awaitingUser).catch((error: unknown) =>
      recordTmwkFailure('rollover', 'automatic', error)
    )
  })
}

async function evaluate(
  runtime: OrcaRuntimeService,
  home: MainHome,
  sessionId: string,
  awaitingUser: boolean
): Promise<void> {
  const usage = await readMainContextUsage(createTmwkRpc(runtime), sessionId)
  const thresholdPercent = resolveRolloverThreshold(usage)
  const usagePercent = usage?.percentage ?? null
  const decision = decideRollover({
    usagePercent,
    thresholdPercent,
    ceilingPercent: ROLLOVER_CEILING_PERCENT,
    awaitingUser,
    refresh: 'none',
    refreshFailures: 0
  })
  console.error(
    `[tmwk] rollover check session=${sessionId} usage=${usagePercent ?? 'unknown'} threshold=${thresholdPercent} decision=${decision}`
  )
  if (decision !== 'prepare' || usagePercent === null || readPendingMainSessionChange(runtime)) {
    return
  }
  const pin = await readMainSessionPin(home.paths.sessionRecord)
  if (pin?.sessionId !== sessionId || readPendingMainSessionChange(runtime)) {
    return
  }
  markPendingMainSessionChange(runtime, { kind: 'rollover', agent: pin.agent, phase: 'saving' })
  try {
    await runMainSessionOperation(runtime, () =>
      runRollover({
        runtime,
        home,
        sessionId,
        agent: pin.agent,
        reason: 'rollover',
        automatic: { usagePercent, thresholdPercent }
      })
    )
  } finally {
    clearPendingMainSessionChange(runtime)
  }
}
