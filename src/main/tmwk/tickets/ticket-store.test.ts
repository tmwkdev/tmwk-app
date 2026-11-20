import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTicketStore, type LiveTicket } from './ticket-store'

function live(taskId: string, patch: Partial<LiveTicket> = {}): LiveTicket {
  return {
    taskId,
    runId: 'run_1',
    title: `Task ${taskId}`,
    status: 'dispatched',
    result: null,
    completedAt: null,
    question: null,
    owner: null,
    ...patch
  }
}

describe('ticket store', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-tickets-')), 'store')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('leaves an unchanged ticket out of since', async () => {
    const store = createTicketStore(storeDir)
    const first = await store.refresh([live('a'), live('b')])
    expect(first.version).toBe(2)
    const second = await store.refresh([live('a'), live('b', { status: 'failed' })])
    expect(second.version).toBe(3)
    const since = await store.list({ since: 2 })
    expect(since.tickets.map((t) => t.taskId)).toEqual(['b'])
    expect(since.version).toBe(3)
  })

  it('drops an accepted result from needs-me but keeps it listed', async () => {
    const store = createTicketStore(storeDir)
    await store.refresh([live('a', { status: 'completed', result: 'done' })])
    expect((await store.list({ needsMe: true })).tickets.map((t) => t.needsMe)).toEqual(['result'])
    await store.accept('a')
    expect((await store.list({ needsMe: true })).tickets).toEqual([])
    expect((await store.list()).tickets).toHaveLength(1)
    await store.refresh([live('a', { status: 'completed', result: 'done' })])
    expect((await store.list({ needsMe: true })).tickets).toEqual([])
  })

  it('drops an unfinished task that is no longer live, except in an unread Run', async () => {
    const store = createTicketStore(storeDir)
    await store.refresh([
      live('a', { question: 'which?' }),
      live('b', { runId: 'run_2' }),
      live('c', { status: 'completed', result: 'done' })
    ])
    await store.refresh([], { unreadRunIds: ['run_2'] })
    expect((await store.list()).tickets.map((t) => t.taskId)).toEqual(['b', 'c'])
  })

  it('asks again for a result that changes after acceptance', async () => {
    const store = createTicketStore(storeDir)
    await store.refresh([live('a', { status: 'completed', result: 'one' })])
    await store.accept('a')
    await store.refresh([live('a', { status: 'completed', result: 'two' })])
    expect((await store.list({ needsMe: true })).tickets.map((t) => t.taskId)).toEqual(['a'])
  })

  it('migrates each v1 snapshot to one ticket with one attempt, once', async () => {
    const snapshot = {
      runId: 'run_1',
      result: null,
      completedAt: null,
      firstSeenAt: '2026-11-01T10:00:00.000Z',
      lastSeenAt: '2026-11-01T11:00:00.000Z',
      acceptedAt: null,
      owner: null
    }
    const v1 = `${JSON.stringify({
      version: 1,
      counter: 7,
      tickets: [
        {
          ...snapshot,
          taskId: 'task_a',
          title: 'Fix login',
          status: 'completed',
          result: 'PR opened',
          completedAt: '2026-11-01T11:00:00.000Z',
          changedAt: 6,
          needsMe: 'result',
          question: null
        },
        {
          ...snapshot,
          taskId: 'task_b',
          title: 'Pick a name',
          status: 'dispatched',
          changedAt: 7,
          needsMe: 'decision',
          question: 'Which name?'
        }
      ]
    })}\n`
    await mkdir(storeDir, { recursive: true })
    await writeFile(join(storeDir, 'tickets.json'), v1)
    const store = createTicketStore(storeDir)

    const first = await store.list()
    expect(first.version).toBe(7)
    expect(
      first.tickets.map((t) => [t.taskId, t.title, t.needsMe, t.attempts, t.changedAt])
    ).toEqual([
      ['task_a', 'Fix login', 'result', 1, 6],
      ['task_b', 'Pick a name', 'decision', 1, 7]
    ])
    expect(await readFile(join(storeDir, 'tickets.json.v1.bak'), 'utf-8')).toBe(v1)

    await store.accept('task_a')
    const stored = JSON.parse(await readFile(join(storeDir, 'tickets.json'), 'utf-8'))
    expect([stored.version, stored.counter, stored.tickets.length]).toEqual([2, 8, 2])
    const second = await store.list()
    expect(second.tickets.map((t) => t.id)).toEqual(first.tickets.map((t) => t.id))
    expect(second.tickets.map((t) => t.needsMe)).toEqual([null, 'decision'])
  })

  it('lists a failed start as a stop, and a later read of its Task keeps it one', async () => {
    const store = createTicketStore(storeDir)
    const { ticket } = await store.create({ words: 'Fix the login redirect' })
    expect((await store.list({ needsMe: true })).tickets).toEqual([])

    await store.attach(ticket.id, {
      runId: 'run_1',
      taskId: 'task_9',
      dispatchId: 'dispatch_1',
      failedStart: true,
      failedStage: 'terminal_create',
      failureReason: 'repo not found'
    })
    await store.refresh([live('task_9', { status: 'ready' })])

    expect((await store.list()).tickets.map((t) => [t.id, t.taskId, t.status, t.needsMe])).toEqual([
      [ticket.id, 'task_9', 'failed', 'stop']
    ])
  })
})
