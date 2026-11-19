import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTicketSnapshotStore, type LiveTicket } from './ticket-snapshot-store'

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

describe('ticket snapshot store', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-tickets-')), 'store')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('leaves an unchanged ticket out of since', async () => {
    const store = createTicketSnapshotStore(storeDir)
    const first = await store.refresh([live('a'), live('b')])
    expect(first.version).toBe(2)
    const second = await store.refresh([live('a'), live('b', { status: 'failed' })])
    expect(second.version).toBe(3)
    const since = await store.list({ since: 2 })
    expect(since.tickets.map((t) => t.taskId)).toEqual(['b'])
    expect(since.version).toBe(3)
  })

  it('drops an accepted result from needs-me but keeps it listed', async () => {
    const store = createTicketSnapshotStore(storeDir)
    await store.refresh([live('a', { status: 'completed', result: 'done' })])
    expect((await store.list({ needsMe: true })).tickets.map((t) => t.needsMe)).toEqual(['result'])
    await store.accept('a')
    expect((await store.list({ needsMe: true })).tickets).toEqual([])
    expect((await store.list()).tickets).toHaveLength(1)
    await store.refresh([live('a', { status: 'completed', result: 'done' })])
    expect((await store.list({ needsMe: true })).tickets).toEqual([])
  })

  it('drops an unfinished task that is no longer live, except in an unread Run', async () => {
    const store = createTicketSnapshotStore(storeDir)
    await store.refresh([
      live('a', { question: 'which?' }),
      live('b', { runId: 'run_2' }),
      live('c', { status: 'completed', result: 'done' })
    ])
    await store.refresh([], { unreadRunIds: ['run_2'] })
    expect((await store.list()).tickets.map((t) => t.taskId)).toEqual(['b', 'c'])
  })

  it('asks again for a result that changes after acceptance', async () => {
    const store = createTicketSnapshotStore(storeDir)
    await store.refresh([live('a', { status: 'completed', result: 'one' })])
    await store.accept('a')
    await store.refresh([live('a', { status: 'completed', result: 'two' })])
    expect((await store.list({ needsMe: true })).tickets.map((t) => t.taskId)).toEqual(['a'])
  })
})
