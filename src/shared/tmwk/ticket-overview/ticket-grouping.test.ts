import { describe, expect, it } from 'vitest'
import { groupTickets, type TicketGroupOptions } from './ticket-grouping'
import type { TicketRowModel, TicketState } from './ticket-row-model'
import { titleCollisions } from './ticket-title-collisions'

function row(id: string, state: TicketState, extra: Partial<TicketRowModel> = {}): TicketRowModel {
  return {
    id,
    title: id,
    projectId: 'tmwk-app',
    projectName: 'tmwk-app',
    state,
    reason: null,
    kind: null,
    handled: null,
    host: null,
    sessions: [],
    startedAt: '2026-11-19T09:00:00.000Z',
    lastActivityAt: null,
    branch: null,
    pr: null,
    changedAt: 1,
    ...extra
  }
}

const options: TicketGroupOptions = {
  groupBy: 'attention',
  sortWithin: 'attention',
  hideDone: false,
  hideOngoing: false,
  hideQuiet: false
}

const ids = (groups: ReturnType<typeof groupTickets>): [string, string[]][] =>
  groups.map((group) => [group.id, group.rows.map((r) => r.id)])

describe('groupTickets', () => {
  it('orders Needs you by decision, stop, result, newest first, and puts ongoing quiet work last', () => {
    const rows = [
      row('result', 'result', { changedAt: 9 }),
      row('ci', 'waiting', { kind: 'ongoing', changedAt: 9 }),
      row('old-decision', 'decision', { changedAt: 2 }),
      row('store', 'running', { changedAt: 1 }),
      row('stop', 'stop', { changedAt: 1 }),
      row('new-decision', 'decision', { changedAt: 5 }),
      row('greet', 'done')
    ]
    expect(ids(groupTickets(rows, options))).toEqual([
      ['attention:needsYou', ['new-decision', 'old-decision', 'stop', 'result']],
      ['attention:quiet', ['store', 'ci']],
      ['attention:done', ['greet']]
    ])
  })

  it('never hides a needs-you ticket, even an ongoing one, behind a filter', () => {
    const rows = [
      row('deploys', 'decision', { kind: 'ongoing' }),
      row('release', 'stop'),
      row('ci', 'waiting', { kind: 'ongoing' }),
      row('store', 'running'),
      row('greet', 'done')
    ]
    expect(
      ids(
        groupTickets(rows, {
          ...options,
          groupBy: 'none',
          hideDone: true,
          hideOngoing: true,
          hideQuiet: true
        })
      )
    ).toEqual([['none', ['deploys', 'release']]])
  })

  it('keeps needs-you rows first, in attention order, whatever Sort within group says', () => {
    const rows = [
      row('old-store', 'running', { lastActivityAt: '2026-11-19T08:00:00.000Z' }),
      row('result', 'result', { lastActivityAt: '2026-11-19T11:00:00.000Z' }),
      row('decision', 'decision', { lastActivityAt: '2026-11-19T07:00:00.000Z' }),
      row('new-store', 'running', { lastActivityAt: '2026-11-19T12:00:00.000Z' })
    ]
    expect(ids(groupTickets(rows, { ...options, sortWithin: 'lastActivity' }))).toEqual([
      ['attention:needsYou', ['decision', 'result']],
      ['attention:quiet', ['new-store', 'old-store']]
    ])
    expect(
      ids(groupTickets(rows, { ...options, groupBy: 'project', sortWithin: 'lastActivity' }))
    ).toEqual([['project:tmwk-app', ['decision', 'result', 'new-store', 'old-store']]])
  })

  it('follows a custom status order', () => {
    const rows = [
      row('settings', 'decision'),
      row('release', 'stop'),
      row('store', 'running'),
      row('greet', 'done')
    ]
    expect(
      ids(
        groupTickets(rows, {
          ...options,
          groupBy: 'status',
          statusOrder: ['done', 'blocked', 'needsDecision']
        })
      )
    ).toEqual([
      ['status:done', ['greet']],
      ['status:blocked', ['release']],
      ['status:needsDecision', ['settings']],
      ['status:running', ['store']]
    ])
  })
})

describe('titleCollisions', () => {
  it('marks every ticket whose title another ticket shares', () => {
    const rows = [
      row('readme-website', 'running', { title: 'Update the README' }),
      row('readme-app', 'running', { title: 'update the  README ' }),
      row('store', 'running', { title: 'Ticket store v2 migration' })
    ]
    expect([...titleCollisions(rows)].sort()).toEqual(['readme-app', 'readme-website'])
  })
})
