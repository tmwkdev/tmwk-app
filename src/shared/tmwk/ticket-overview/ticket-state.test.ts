import { describe, expect, it } from 'vitest'
import { deriveTicketState, type TicketStateInput } from './ticket-state'

const listing = (patch: Partial<TicketStateInput>): TicketStateInput => ({
  needsMe: null,
  acceptedAt: null,
  status: 'dispatched',
  kind: null,
  ...patch
})

describe('deriveTicketState', () => {
  it('makes a requested ticket with a pending ask a decision', () => {
    expect(deriveTicketState(listing({ status: 'requested', needsMe: 'decision' }))).toBe(
      'decision'
    )
    expect(deriveTicketState(listing({ status: 'requested' }))).toBe('waiting')
  })

  it('never lets an unreachable host hide a question, but pauses running work', () => {
    expect(deriveTicketState(listing({ needsMe: 'decision' }), { hostUnreachable: true })).toBe(
      'decision'
    )
    expect(deriveTicketState(listing({}), { hostUnreachable: true })).toBe('paused')
    expect(deriveTicketState(listing({}))).toBe('running')
  })

  it('makes an accepted ticket Done', () => {
    expect(
      deriveTicketState(listing({ status: 'completed', acceptedAt: '2026-11-20T10:00:00.000Z' }))
    ).toBe('done')
  })
})
