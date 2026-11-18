import { describe, expect, it } from 'vitest'
import { decideRollover, type RolloverDecisionInput } from './rollover-decision'

const base: RolloverDecisionInput = {
  usagePercent: 75,
  thresholdPercent: 70,
  ceilingPercent: 90,
  awaitingUser: false,
  refresh: 'none',
  refreshFailures: 0
}

describe('decideRollover', () => {
  it('waits below the threshold', () => {
    expect(decideRollover({ ...base, usagePercent: 69 })).toBe('wait')
  })

  it('waits while the session awaits the user', () => {
    expect(decideRollover({ ...base, awaitingUser: true })).toBe('wait')
  })

  it('waits on unknown usage', () => {
    expect(decideRollover({ ...base, usagePercent: null })).toBe('wait')
  })

  it('prepares at the threshold, then rolls over once the summary is stored', () => {
    expect(decideRollover({ ...base, usagePercent: 70 })).toBe('prepare')
    expect(decideRollover({ ...base, refresh: 'stored' })).toBe('roll-over')
  })

  it('retries after one failed refresh, then falls back after two', () => {
    expect(decideRollover({ ...base, refresh: 'failed', refreshFailures: 1 })).toBe('wait')
    expect(decideRollover({ ...base, refresh: 'failed', refreshFailures: 2 })).toBe(
      'roll-over-with-fallback'
    )
  })

  it('falls back at the ceiling on the first failure', () => {
    expect(
      decideRollover({ ...base, usagePercent: 90, refresh: 'failed', refreshFailures: 1 })
    ).toBe('roll-over-with-fallback')
  })
})
