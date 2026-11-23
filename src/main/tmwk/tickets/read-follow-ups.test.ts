import { z } from 'zod'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { readFollowUps } from './read-follow-ups'
import { createTicketStore, type LiveTicket } from './ticket-store'

const WORKTREE = 'repo_home::/Users/ty/orca/workspaces/tmwk-app/telemetry'

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
    await rm(join(storeDir, '..'), { recursive: true, force: true })
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
