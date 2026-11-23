import { z } from 'zod'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { readFollowUps } from './read-follow-ups'
import { createTicketStore, type LiveTicket } from './ticket-store'

const WORKTREE = 'repo_home::/work/telemetry'

function task(taskId: string, patch: Partial<LiveTicket> = {}): LiveTicket {
  return {
    taskId,
    runId: 'run_main',
    title: 'Telemetry',
    status: 'dispatched',
    result: null,
    completedAt: null,
    question: null,
    owner: null,
    ownerGone: null,
    ...patch
  }
}

function workers(rows: unknown[]) {
  return { workers: rows, page: { nextCursor: null } }
}

describe('follow-ups', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-follow-ups-')), 'store')
  })
  afterEach(async () => {
    vi.useRealTimers()
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('keeps an accepted ticket and its title through follow-ups begun before it was accepted', async () => {
    const rows = [
      { dispatchId: 'ctx_answers', taskId: 'task_answers', createdAt: '2026-11-20 18:14:38' },
      { dispatchId: 'ctx_rebase', taskId: 'task_rebase', createdAt: '2026-11-20 18:40:00' }
    ]
    const of: Record<string, string> = {
      ctx_answers: 'ctx_plan',
      ctx_rebase: 'ctx_answers',
      ctx_later: 'ctx_rebase'
    }
    const home: TmwkRpc = async (method, params) => {
      if (method === 'orchestration.workerList') {
        return workers(rows.map(({ dispatchId, taskId }) => ({ dispatchId, taskId })))
      }
      if (method === 'orchestration.workerShow') {
        const { dispatch } = z.object({ dispatch: z.string() }).parse(params)
        const row = rows.find((candidate) => candidate.dispatchId === dispatch)
        return {
          dispatch: { runId: 'run_main', followUpOf: of[dispatch], createdAt: row?.createdAt }
        }
      }
      throw new Error(`unexpected ${method}`)
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-20T20:36:52.683Z'))
    const store = createTicketStore(storeDir)
    const plan = task('task_plan', {
      title: 'Plan: identity and egress boundary',
      status: 'completed',
      result: 'Draft PR #57'
    })
    await store.refresh([plan], {
      dispatches: new Map([['task_plan', { dispatchId: 'ctx_plan' }]])
    })
    const { ticket } = await store.accept('task_plan')

    vi.setSystemTime(new Date('2026-11-23T16:10:13.490Z'))
    const old = [
      plan,
      task('task_answers', {
        title: 'Owner answers on PR #57',
        status: 'completed',
        result: 'a',
        completedAt: '2026-11-20T18:17:16.398Z'
      }),
      task('task_rebase', {
        title: 'Rebase #57 so it can merge',
        status: 'completed',
        result: 'b',
        completedAt: '2026-11-20T18:53:02.735Z'
      })
    ]
    await store.refresh(old, {
      dispatches: new Map(rows.map((row) => [row.taskId, { dispatchId: row.dispatchId }]))
    })
    const read = await readFollowUps(home, (await store.records()).records, old)
    expect(read.followUps).toEqual([
      {
        followUpOf: 'ctx_plan',
        dispatchId: 'ctx_answers',
        taskId: 'task_answers',
        startedAt: '2026-11-20T18:14:38.000Z'
      },
      {
        followUpOf: 'ctx_answers',
        dispatchId: 'ctx_rebase',
        taskId: 'task_rebase',
        startedAt: '2026-11-20T18:40:00.000Z'
      }
    ])
    await store.refresh(old, { followUps: read.followUps })
    const kept = (await store.records()).records
    expect(kept.map((r) => [r.id, r.title, r.status, r.acceptedAt, r.attempts.length])).toEqual([
      [ticket.id, 'Plan: identity and egress boundary', 'accepted', '2026-11-20T20:36:52.683Z', 3]
    ])
    expect((await store.list({ needsMe: true })).tickets).toEqual([])

    await store.refresh([
      ...old.slice(0, 2),
      { ...old[2], result: 'b, then rebased again', completedAt: '2026-11-23T16:15:00.000Z' }
    ])
    expect((await store.list({ needsMe: true })).tickets.map((t) => t.result)).toEqual([
      'b, then rebased again'
    ])
    await store.accept(ticket.id)

    rows.push({ dispatchId: 'ctx_later', taskId: 'task_later', createdAt: '2026-11-23 16:20:00' })
    vi.setSystemTime(new Date('2026-11-23T16:20:05.000Z'))
    const later = [...old, task('task_later', { title: 'One more rebase' })]
    const next = await readFollowUps(home, (await store.records()).records, later)
    await store.refresh(later, { followUps: next.followUps })
    expect((await store.list()).tickets.map((t) => [t.title, t.status, t.needsMe])).toEqual([
      ['Plan: identity and egress boundary', 'dispatched', null]
    ])
    await store.refresh([...old, task('task_later', { status: 'completed', result: 'rebased' })])
    expect((await store.list()).tickets.map((t) => [t.status, t.needsMe, t.result])).toEqual([
      ['completed', 'result', 'rebased']
    ])
  })

  it('reopens a finished ticket on the home host and folds in the Task Orca made for it', async () => {
    const home: TmwkRpc = async (method, params) => {
      if (method === 'orchestration.workerList') {
        return workers([
          { dispatchId: 'ctx_home_1', taskId: 'task_home_1', resource: { worktreeId: WORKTREE } },
          { dispatchId: 'ctx_home_2', taskId: 'task_home_2', resource: { worktreeId: WORKTREE } }
        ])
      }
      if (method === 'orchestration.workerShow') {
        const { dispatch } = z.object({ dispatch: z.string() }).parse(params)
        return {
          dispatch: {
            runId: 'run_main',
            followUpOf: dispatch === 'ctx_home_2' ? 'ctx_home_1' : null
          }
        }
      }
      throw new Error(`unexpected ${method}`)
    }
    const store = createTicketStore(storeDir)
    const { ticket } = await store.create({ words: 'Telemetry' })
    await store.attach(ticket.id, {
      runId: 'run_main',
      taskId: 'task_home_1',
      dispatchId: 'ctx_home_1',
      worktreeId: WORKTREE
    })
    const first = task('task_home_1', { status: 'completed', result: 'first pass' })
    await store.refresh([first])
    await store.refresh([first, task('task_home_2')])
    expect((await store.list()).tickets).toHaveLength(2)

    const read = await readFollowUps(home, (await store.records()).records, [])
    expect(read).toEqual({
      followUps: [{ followUpOf: 'ctx_home_1', dispatchId: 'ctx_home_2', taskId: 'task_home_2' }],
      live: [],
      gone: []
    })
    await store.refresh([first, task('task_home_2')], { followUps: read.followUps })

    const reopened = await store.list()
    expect(reopened.tickets.map((t) => [t.id, t.status, t.needsMe, t.dispatchId])).toEqual([
      [ticket.id, 'dispatched', null, 'ctx_home_2']
    ])
    expect((await store.show(ticket.id)).ticket.attempts.at(-1)).toMatchObject({
      taskId: 'task_home_2',
      followUpOf: 'ctx_home_1',
      worktreeId: WORKTREE
    })

    await store.refresh([
      first,
      task('task_home_2', { status: 'completed', result: 'second pass' })
    ])
    const settled = await store.list()
    expect(settled.tickets.map((t) => [t.status, t.needsMe, t.result])).toEqual([
      ['completed', 'result', 'second pass']
    ])

    await store.refresh([task('task_home_3', { status: 'completed' }), task('task_home_4')], {
      followUps: [
        { followUpOf: 'ctx_home_2', dispatchId: 'ctx_home_3', taskId: 'task_home_3' },
        { followUpOf: 'ctx_home_3', dispatchId: 'ctx_home_4', taskId: 'task_home_4' }
      ]
    })
    const chained = await store.list()
    expect(chained.tickets.map((t) => [t.attempts, t.dispatchId, t.status])).toEqual([
      [4, 'ctx_home_4', 'dispatched']
    ])
  })

  it("follows a paired server's follow-up through that server's Task", async () => {
    const home: TmwkRpc = async (method) => {
      if (method === 'orchestration.workerList') {
        return workers([
          {
            dispatchId: 'ctx_mbp_2',
            taskId: 'task_mbp_2',
            server: { environmentId: 'env_mbp', name: 'mbp', asOf: '2026-11-22T10:00:00Z' }
          }
        ])
      }
      throw new Error(`unexpected ${method}`)
    }
    let listed = true
    const mbp: TmwkRpc = async (method, params) => {
      if (method === 'orchestration.workerShow') {
        return { dispatch: { runId: 'run_mbp', followUpOf: 'ctx_mbp_1' } }
      }
      if (method === 'orchestration.taskList') {
        expect(params).toEqual({ run: 'run_mbp' })
        if (!listed) {
          return { tasks: [] }
        }
        return {
          tasks: [
            {
              id: 'task_mbp_2',
              run_id: 'run_mbp',
              task_title: 'Telemetry follow-up',
              spec: 'Fix the review comments',
              status: 'dispatched',
              result: null,
              completed_at: null,
              assignee_handle: 'term_mbp'
            }
          ]
        }
      }
      throw new Error(`unexpected ${method}`)
    }
    const store = createTicketStore(storeDir)
    const { ticket } = await store.create({ words: 'Telemetry' })
    await store.attach(ticket.id, {
      runId: 'run_main',
      taskId: 'task_mbp_1',
      dispatchId: 'ctx_mbp_1',
      host: 'mbp'
    })
    await store.refresh([task('task_mbp_1', { status: 'completed', result: 'first pass' })])

    const read = await readFollowUps(home, (await store.records()).records, [], () => mbp)
    expect(read.followUps).toEqual([
      { followUpOf: 'ctx_mbp_1', dispatchId: 'ctx_mbp_2', taskId: 'task_mbp_2' }
    ])
    expect(read.live).toEqual([
      {
        taskId: 'task_mbp_2',
        runId: 'run_main',
        title: 'Telemetry follow-up',
        status: 'dispatched',
        result: null,
        completedAt: null,
        question: null,
        owner: 'term_mbp',
        ownerGone: null
      }
    ])
    await store.refresh(read.live, { followUps: read.followUps })
    await store.refresh([])

    const again = await readFollowUps(home, (await store.records()).records, [], () => mbp)
    expect(again.followUps).toEqual([])
    expect(again.live.map((entry) => entry.taskId)).toEqual(['task_mbp_2'])
    const { tickets } = await store.list()
    expect(tickets.map((t) => [t.status, t.needsMe, t.dispatchId, t.host, t.failure])).toEqual([
      ['dispatched', null, 'ctx_mbp_2', 'mbp', null]
    ])

    listed = false
    const removed = await readFollowUps(home, (await store.records()).records, [], () => mbp)
    expect([removed.live, removed.gone]).toEqual([[], ['task_mbp_2']])
    await store.refresh([], { gone: removed.gone })
    expect((await store.list()).tickets.map((t) => [t.status, t.failure])).toEqual([
      ['failed', 'Its Orca task is gone before it finished.']
    ])
  })
})
