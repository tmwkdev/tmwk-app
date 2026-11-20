import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { readAttemptFacts } from './read-attempt-facts'
import { readTaskDispatches } from './read-task-dispatches'
import { createTicketStore, type LiveTicket } from './ticket-store'

const live: LiveTicket = {
  taskId: 'task_remote',
  runId: 'run_main',
  title: 'Telemetry stage 2',
  status: 'dispatched',
  result: null,
  completedAt: null,
  question: null,
  owner: 'term_home_handle'
}

// What the home host lists for a dispatch a paired server runs: no projection, no terminal.
const home: TmwkRpc = async (method) => {
  if (method !== 'orchestration.workerList') {
    throw new Error(`unexpected ${method}`)
  }
  return {
    workers: [
      {
        dispatchId: 'ctx_remote',
        taskId: 'task_remote',
        agentTerminalHandle: null,
        resource: null,
        server: { environmentId: 'env_mbp', name: 'mbp', asOf: '2026-11-20T20:22:43Z' }
      }
    ],
    page: { nextCursor: null }
  }
}

// What the paired server itself says about the same dispatch.
const mbp: TmwkRpc = async (method) => {
  if (method === 'orchestration.workerShow') {
    return {
      worker: {
        worktreeId: 'repo_mbp::/Users/ty/orca/workspaces/tmwk-app/telemetry-stage2',
        agentTerminalHandle: 'term_c797fd0e',
        startOptions: {
          launch: { requested: { agent: 'claude' }, effective: { agent: 'claude', model: null } }
        }
      },
      projection: { provider: { id: 'claude', model: 'claude-opus-5-5' } }
    }
  }
  if (method === 'worktree.show') {
    return { worktree: { repoId: 'repo_mbp', git: { branch: 'refs/heads/telemetry-stage2' } } }
  }
  throw new Error(`unexpected ${method}`)
}

describe('dispatch backfill', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-dispatches-')), 'store')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('links a ticket started outside ticket start to its owner on a paired server', async () => {
    const store = createTicketStore(storeDir)
    await store.refresh([live])
    const dispatches = await readTaskDispatches(home, (await store.records()).records, [live])
    await store.refresh([live], { dispatches })
    const servers: string[] = []
    const facts = await readAttemptFacts(home, await store.followed(), (server) => {
      servers.push(server)
      return mbp
    })
    await store.refresh([live], { facts })

    expect(servers).toEqual(['mbp'])
    const { ticket } = await store.show('task_remote')
    expect(ticket.attempts).toHaveLength(1)
    expect(ticket.attempts[0]).toMatchObject({
      taskId: 'task_remote',
      dispatchId: 'ctx_remote',
      host: 'mbp',
      agent: 'claude',
      model: 'claude-opus-5-5',
      worktreeId: 'repo_mbp::/Users/ty/orca/workspaces/tmwk-app/telemetry-stage2',
      terminalHandle: 'term_c797fd0e',
      repo: 'repo_mbp',
      branch: 'telemetry-stage2'
    })
  })

  it('never replaces the dispatch ticket start attached', async () => {
    const store = createTicketStore(storeDir)
    const created = await store.create({ words: 'Telemetry stage 2' })
    await store.attach(created.ticket.id, { taskId: 'task_remote', dispatchId: 'ctx_started' })
    const records = (await store.records()).records
    expect(await readTaskDispatches(home, records, [live])).toEqual(new Map())
    await store.refresh([live], {
      dispatches: new Map([['task_remote', { dispatchId: 'ctx_remote', host: 'mbp' }]])
    })
    const { ticket } = await store.show(created.ticket.id)
    expect(ticket.attempts[0].dispatchId).toBe('ctx_started')
    expect(ticket.attempts[0].host).toBeUndefined()
  })
})
