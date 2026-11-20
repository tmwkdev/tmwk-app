import { describe, expect, it } from 'vitest'
import type { TmwkHealthEvent } from '../../../shared/tmwk/tmwk-health'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { buildTmwkHealthView } from './read-tmwk-health'

const NOW = Date.parse('2026-11-20T12:00:00Z')

function failure(kind: 'summary' | 'rollover', at: string): TmwkHealthEvent {
  return { type: 'failure', kind, stage: 'refresh', message: kind, at, repeats: 1 }
}

function ticket(
  id: string,
  attempt: Partial<TmwkTicketRecord['attempts'][number]> | null,
  extra: Partial<TmwkTicketRecord> = {}
): TmwkTicketRecord {
  return {
    id,
    title: id,
    words: '',
    status: 'active',
    origin: 'tmwk',
    attempts: attempt ? [{ startedAt: '2026-11-01T00:00:00Z', ...attempt }] : [],
    history: [],
    createdAt: '2026-11-01T00:00:00Z',
    changedAt: 1,
    ...extra
  }
}

describe('tmwk health view', () => {
  it('lists recent failures newest first and counts the last 7 days', () => {
    const events: TmwkHealthEvent[] = [
      failure('rollover', '2026-11-10T00:00:00Z'),
      failure('summary', '2026-11-19T00:00:00Z'),
      failure('rollover', '2026-11-20T11:00:00Z'),
      { type: 'rollover', summary: 'stored', at: '2026-11-19T00:00:00Z' },
      { type: 'rollover', summary: 'stored', at: '2026-11-20T00:00:00Z' },
      { type: 'rollover', summary: 'fallback', at: '2026-11-18T00:00:00Z' },
      { type: 'rollover', summary: 'stale', at: '2026-11-01T00:00:00Z' }
    ]
    const tickets = [
      ticket('done', { outcome: 'completed', settledAt: '2026-11-19T00:00:00Z' }),
      ticket('done-by-orca-time', {
        outcome: 'completed',
        settledAt: '2026-11-20T00:00:00Z',
        observed: {
          title: 't',
          status: 'completed',
          result: null,
          completedAt: '2026-11-01T00:00:00Z',
          question: null,
          owner: null,
          firstSeenAt: '2026-11-01T00:00:00Z',
          lastSeenAt: '2026-11-20T00:00:00Z'
        }
      }),
      ticket(
        'ongoing',
        { outcome: 'completed', settledAt: '2026-11-19T00:00:00Z' },
        { kind: 'ongoing' }
      ),
      ticket('failed', { outcome: 'failed', settledAt: '2026-11-19T00:00:00Z' }),
      ticket('no-start', { outcome: 'failed_start', settledAt: '2026-11-19T00:00:00Z' }),
      ticket('lost', { outcome: 'lost', settledAt: '2026-11-18T00:00:00Z' }),
      ticket('running', {}),
      ticket('requested', null)
    ]
    expect(buildTmwkHealthView(events, tickets, NOW)).toEqual({
      windowDays: 7,
      failures: [
        expect.objectContaining({ kind: 'rollover', at: '2026-11-20T11:00:00Z' }),
        expect.objectContaining({ kind: 'summary', at: '2026-11-19T00:00:00Z' })
      ],
      rollovers: { stored: 2, fallback: 1, stale: 0 },
      tickets: { completed: 1, failed: 2, lost: 1, open: 1 }
    })
  })

  it('is all zeros with nothing recorded', () => {
    expect(buildTmwkHealthView([], [], NOW)).toEqual({
      windowDays: 7,
      failures: [],
      rollovers: { stored: 0, fallback: 0, stale: 0 },
      tickets: { completed: 0, failed: 0, lost: 0, open: 0 }
    })
  })
})
