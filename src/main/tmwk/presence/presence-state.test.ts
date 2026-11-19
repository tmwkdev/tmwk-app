import { describe, expect, it } from 'vitest'
import { applyPresenceEvent, tickPresence, type PresenceState } from './presence-state'

const THIRTY_MIN = 30 * 60_000
const fresh: PresenceState = { lastPresentAt: null, awaySince: null, digestVersion: 4 }

describe('presence', () => {
  it('returns once per absence and never without one', () => {
    const first = applyPresenceEvent(
      fresh,
      { kind: 'view-visible', at: '2026-11-18T10:00:00.000Z' },
      THIRTY_MIN
    )
    expect(first.status).toBe('present')

    const soon = applyPresenceEvent(
      first.state,
      { kind: 'user-turn', at: '2026-11-18T10:29:00.000Z' },
      THIRTY_MIN
    )
    expect(soon.status).toBe('present')

    const away = tickPresence(soon.state, '2026-11-18T11:00:00.000Z', THIRTY_MIN)
    expect(away.status).toBe('away')
    expect(away.state.awaySince).toBe('2026-11-18T10:29:00.000Z')

    const back = applyPresenceEvent(
      away.state,
      { kind: 'view-visible', at: '2026-11-18T12:00:00.000Z' },
      THIRTY_MIN
    )
    expect(back.status).toBe('returned')
    expect(back.returnedFrom).toBe('2026-11-18T10:29:00.000Z')

    const gap = applyPresenceEvent(
      { lastPresentAt: '2026-11-18T13:00:00.000Z', awaySince: null, digestVersion: 1 },
      { kind: 'user-turn', at: '2026-11-18T13:30:00.000Z' },
      THIRTY_MIN
    )
    expect(gap.status).toBe('returned')

    const again = applyPresenceEvent(
      back.state,
      { kind: 'view-visible', at: '2026-11-18T12:01:00.000Z' },
      THIRTY_MIN
    )
    expect(again.status).toBe('present')
  })
})
