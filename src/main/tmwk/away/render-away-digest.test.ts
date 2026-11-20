import { describe, expect, it } from 'vitest'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import { renderAwayDigest } from './render-away-digest'

function ticket(overrides: Partial<TmwkTicketListing>): TmwkTicketListing {
  return {
    taskId: 't',
    runId: 'r',
    title: 'Ticket',
    status: 'completed',
    result: null,
    completedAt: null,
    firstSeenAt: '2026-11-18T10:00:00.000Z',
    lastSeenAt: '2026-11-18T10:00:00.000Z',
    acceptedAt: null,
    changedAt: 5,
    needsMe: null,
    question: null,
    owner: null,
    id: 'tk_1',
    ticketStatus: 'active',
    kind: null,
    attempts: 1,
    dispatchId: null,
    host: null,
    agent: null,
    failure: null,
    ...overrides
  }
}

const base = {
  running: 2,
  awaySince: '2026-11-18T14:05:00.000Z',
  now: new Date('2026-11-18T16:00:00.000Z'),
  timeZone: 'UTC'
}

describe('Away digest', () => {
  it('is null when nothing changed', () => {
    expect(
      renderAwayDigest({
        ...base,
        changed: [],
        needsMe: [ticket({ needsMe: 'result', result: 'Done' })]
      })
    ).toBeNull()
  })

  it('lists decisions, then stops, then results', () => {
    const text = renderAwayDigest({
      ...base,
      changed: [ticket({ taskId: 'a', changedAt: 6, needsMe: 'result', result: 'Shipped' })],
      needsMe: [
        ticket({ taskId: 'a', title: 'Ship', needsMe: 'result', result: 'Shipped\nmore' }),
        ticket({ taskId: 'b', title: 'Build', needsMe: 'stop', status: 'failed', result: 'Boom' }),
        ticket({ taskId: 'c', title: 'Pick', needsMe: 'decision', question: 'Which one?' })
      ]
    })
    expect(text?.split('\n').slice(0, 6)).toEqual([
      'While you were away (since 14:05)',
      'Needs you',
      '- Decision: Pick: Which one?',
      '- Stop: Build: Boom',
      '- Result: Ship: Shipped',
      'Still running: 2'
    ])
  })
})
