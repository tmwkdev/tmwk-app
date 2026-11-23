import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeClient } from '../runtime/client'
import { TMWK_TICKET_START_HANDLERS } from './ticket-start-handler'

vi.mock('../orchestration/identity/terminal-identity', () => ({
  resolveCoordinatorTerminalHandle: vi.fn(async () => 'term_partner')
}))

vi.mock('../runtime/profile/metadata', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDefaultUserDataPath: () => '/tmp/orca-test-profile'
}))

vi.mock('../../shared/remote-runtime/host-store/runtime-environment-store', () => ({
  listEnvironments: vi.fn(async () => [{ id: 'env-mbp', name: 'mbp' }])
}))

const ticket = { id: 'tkt_1', title: 'Fix login', attempts: [] }
const listing = { id: 'tkt_1', failure: null, taskId: 'task_1', dispatchId: 'disp_1', host: 'mbp' }

const results: Record<string, unknown> = {
  'orchestration.runList': { runs: [{ id: 'run_main', objective: 'main' }] },
  'tmwk.brief': { briefId: 'brief_1', text: 'spec' },
  'tmwk.ticketCreate': { ticket, listing },
  'repo.show': { repo: { id: 'repo_home', displayName: 'tmwk-app' } },
  'orchestration.taskCreate': { task: { id: 'task_1' } },
  'orchestration.workerStart': {
    runId: 'run_main',
    taskId: 'task_1',
    dispatchId: 'disp_1',
    state: 'ready'
  },
  'tmwk.ticketAttach': { ticket, listing }
}

describe('tmwk ticket start --host', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places the owner on the server with the home repo named, not by its home id', async () => {
    const call = vi.fn(async (method: string) => ({ ok: true, result: results[method] }))
    const flags = new Map<string, string | boolean>([
      ['goal', 'Fix the login redirect'],
      ['words', 'fix login'],
      ['project', 'id:repo_home'],
      ['host', 'mbp']
    ])

    await TMWK_TICKET_START_HANDLERS['tmwk ticket start']({
      flags,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the start handler uses only client.call.
      client: { call } as unknown as RuntimeClient,
      cwd: '/tmp/repo',
      json: true
    })

    expect(call).toHaveBeenCalledWith(
      'orchestration.workerStart',
      expect.objectContaining({ on: 'mbp', repo: 'name:tmwk-app' })
    )
  })
  it('refuses a --host that names no paired server before writing a ticket', async () => {
    const call = vi.fn(async (method: string) => ({ ok: true, result: results[method] }))
    const flags = new Map<string, string | boolean>([
      ['goal', 'Fix the login redirect'],
      ['words', 'fix login'],
      ['host', 'runtime:typo']
    ])

    await expect(
      TMWK_TICKET_START_HANDLERS['tmwk ticket start']({
        flags,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the start handler uses only client.call.
        client: { call } as unknown as RuntimeClient,
        cwd: '/tmp/repo',
        json: true
      })
    ).rejects.toThrow('Unknown Orca server')
    expect(call).not.toHaveBeenCalledWith('tmwk.ticketCreate', expect.anything())
  })
})
