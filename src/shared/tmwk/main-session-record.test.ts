import { describe, expect, it } from 'vitest'
import { isMainSessionRecord } from './main-session-record'

describe('main session record', () => {
  it('An old pin still loads', () => {
    expect(
      isMainSessionRecord({
        sessionId: 'orca_session_id:old',
        agent: 'claude',
        createdAt: '2026-11-18T00:00:00Z'
      })
    ).toBe(true)
  })
})
