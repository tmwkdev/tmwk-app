import { describe, expect, it } from 'vitest'
import { orderTickets } from '../../../shared/tmwk/ticket-overview/ticket-state'
import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { buildTicketRows } from './build-ticket-rows'
import type { TicketFleet } from './read-ticket-fleet'
import { listTicket } from './ticket-listing'

const STARTED = '2026-11-20T09:00:00.000Z'

function attempt(
  status: 'dispatched' | 'completed' | 'failed',
  patch: Partial<TmwkTicketAttempt> = {}
): TmwkTicketAttempt {
  return {
    runId: 'run_main',
    taskId: `task_${patch.dispatchId ?? status}`,
    startedAt: STARTED,
    ...(status === 'dispatched'
      ? {}
      : { settledAt: STARTED, outcome: status === 'completed' ? 'completed' : 'failed' }),
    observed: {
      title: 'observed',
      status,
      result: status === 'dispatched' ? null : `${status} report`,
      completedAt: null,
      question: null,
      owner: null,
      firstSeenAt: STARTED,
      lastSeenAt: STARTED
    },
    ...patch
  }
}

function record(
  id: string,
  changedAt: number,
  patch: Partial<TmwkTicketRecord> = {}
): TmwkTicketRecord {
  return {
    id,
    title: id,
    words: id,
    status: 'active',
    origin: 'tmwk',
    attempts: [],
    history: [],
    createdAt: STARTED,
    changedAt,
    ...patch
  }
}

const records: TmwkTicketRecord[] = [
  record('done', 9, {
    status: 'accepted',
    acceptedAt: STARTED,
    attempts: [attempt('completed')]
  }),
  record('running-old', 2, { attempts: [attempt('dispatched', { dispatchId: 'd_old' })] }),
  record('result', 7, { attempts: [attempt('completed')] }),
  record('requested', 8, { status: 'requested' }),
  record('stop', 3, { attempts: [attempt('failed')] }),
  record('running-new', 6, { attempts: [attempt('dispatched', { dispatchId: 'd_new' })] }),
  record('asked', 1, {
    status: 'requested',
    question: { id: 'q_1', text: 'Which page?', askedAt: STARTED }
  }),
  record('ongoing', 10, {
    kind: 'ongoing',
    attempts: [attempt('dispatched', { dispatchId: 'd_on' })]
  })
]

const ORDER = [
  'asked',
  'stop',
  'result',
  'running-new',
  'running-old',
  'requested',
  'ongoing',
  'done'
]

describe('buildTicketRows', () => {
  it('orders the overview as `tmwk tickets` orders its listings', () => {
    expect(buildTicketRows(records, null, new Map()).map((row) => row.id)).toEqual(ORDER)
    expect(orderTickets(records.map(listTicket)).map((ticket) => ticket.id)).toEqual(ORDER)
  })

  it('joins sessions by dispatch id and pauses work on an unreachable paired server', () => {
    const remote = record('remote', 5, {
      attempts: [attempt('dispatched', { dispatchId: 'd_remote', host: 'mbp', agent: 'codex' })]
    })
    const fleet: TicketFleet = {
      workers: new Map([
        [
          'd_remote',
          {
            dispatchId: 'd_remote',
            taskId: 'task_d_remote',
            parentTaskId: null,
            agent: null,
            model: null,
            terminalHandle: null,
            worktreeId: null,
            status: 'idle',
            executionHostId: null,
            hostUnavailable: false,
            lastActivityAt: '2026-11-20T09:30:00.000Z',
            server: { environmentId: 'env_mbp', name: 'MBP', asOf: '2026-11-20T09:30:00.000Z' }
          }
        ]
      ]),
      servers: new Map([['d_remote', { reachable: false, lastAnsweredAt: null }]])
    }
    const [row] = buildTicketRows([remote], fleet, new Map())
    expect(row.state).toBe('paused')
    expect(row.host).toEqual({
      id: 'env_mbp',
      label: 'MBP',
      reachable: false,
      lastReportAt: '2026-11-20T09:30:00.000Z'
    })
    expect(row.sessions.map((session) => [session.id, session.agent, session.status])).toEqual([
      ['d_remote', 'codex', 'working']
    ])
  })
})
