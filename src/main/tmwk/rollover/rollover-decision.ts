import { readDevEnvOverride } from '../dev-env-override'
import type { MainContextUsage } from './read-main-context-usage'

export const ROLLOVER_DEFAULT_PERCENT = 70
export const ROLLOVER_CEILING_PERCENT = 90
export const ROLLOVER_REFRESH_FAILURES_BEFORE_FALLBACK = 2

const AUTO_COMPACT_MARGIN_POINTS = 5
const THRESHOLD_FLOOR_PERCENT = 20

export type RolloverRefresh = 'none' | 'stored' | 'failed'
export type RolloverDecision = 'wait' | 'prepare' | 'roll-over' | 'roll-over-with-fallback'

export type RolloverDecisionInput = {
  /** Null when the agent reports no usable context facts. */
  usagePercent: number | null
  thresholdPercent: number
  ceilingPercent: number
  awaitingUser: boolean
  refresh: RolloverRefresh
  refreshFailures: number
}

export function decideRollover(input: RolloverDecisionInput): RolloverDecision {
  const { usagePercent, thresholdPercent, ceilingPercent, awaitingUser, refresh } = input
  if (awaitingUser || usagePercent === null || usagePercent < thresholdPercent) {
    return 'wait'
  }
  if (refresh === 'none') {
    return 'prepare'
  }
  if (refresh === 'stored') {
    return 'roll-over'
  }
  return input.refreshFailures >= ROLLOVER_REFRESH_FAILURES_BEFORE_FALLBACK ||
    usagePercent >= ceilingPercent
    ? 'roll-over-with-fallback'
    : 'wait'
}

function parseOverride(raw: string | undefined): number | null {
  const value = Number(raw)
  return raw !== undefined && Number.isFinite(value) && value > 0 && value <= 100 ? value : null
}

/** 70%, lowered to just before Claude's auto-compact point; `TMWK_ROLLOVER_PERCENT` applies only in dev and E2E. */
export function resolveRolloverThreshold(
  usage: MainContextUsage | null,
  env: NodeJS.ProcessEnv = process.env
): number {
  const override = parseOverride(readDevEnvOverride('TMWK_ROLLOVER_PERCENT', env))
  if (override !== null) {
    return override
  }
  if (usage?.autoCompactAtTokens && usage.windowTokens) {
    const beforeCompact =
      (usage.autoCompactAtTokens / usage.windowTokens) * 100 - AUTO_COMPACT_MARGIN_POINTS
    return Math.min(ROLLOVER_DEFAULT_PERCENT, Math.max(THRESHOLD_FLOOR_PERCENT, beforeCompact))
  }
  return ROLLOVER_DEFAULT_PERCENT
}
