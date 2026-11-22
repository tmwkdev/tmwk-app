import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { createTicketStore, type LiveTicket, type TicketStore } from './ticket-store'
import { cleanUpAcceptedWorktrees, type TicketWorktreeCleanupDeps } from './ticket-worktree-cleanup'

type FakeWorktree = {
  blockers?: string[]
  /** One live terminal; `agentState` is its pane's agent row. */
  terminal?: {
    foreground: string | null
    childProcessEvidence?: string
    agentState?: string
    /** inspectProcess answers terminal_gone, as when the handle's leaf was replaced. */
    gone?: boolean
  }
  agentState?: string
  active?: boolean
  /** Null: a host from before the at-risk local files check. */
  atRiskLocalFiles?: { count: number; samplePaths: string[]; complete: boolean } | null
}

const WorktreeParam = z.object({ worktree: z.string().optional() })
const TerminalParam = z.object({ terminal: z.string() })
const ScanParams = z.object({ worktreeIds: z.array(z.string()) })

const LEAF_ID = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60'

function fakeHost(
  worktrees: Record<string, FakeWorktree>,
  hostId: string,
  onScan: () => Promise<unknown> = async () => undefined
) {
  const calls: { method: string; params: unknown }[] = []
  const rpc: TmwkRpc = async (method, params) => {
    calls.push({ method, params })
    const id = WorktreeParam.parse(params ?? {}).worktree?.replace(/^id:/, '') ?? ''
    switch (method) {
      case 'status.get':
        return { capabilities: ['worktree.remove-branch-policy.v1'] }
      case 'worktree.ps':
        return {
          truncated: false,
          worktrees: Object.entries(worktrees).map(([worktreeId, wt]) => ({
            worktreeId,
            liveTerminalCount: wt.terminal ? 1 : 0,
            unverifiableTerminalCount: 0,
            isActive: wt.active === true,
            agents: [
              ...(wt.agentState ? [{ paneKey: 'tab_2:other', state: wt.agentState }] : []),
              ...(wt.terminal?.agentState
                ? [{ paneKey: `tab_1:${LEAF_ID}`, state: wt.terminal.agentState }]
                : [])
            ]
          }))
        }
      case 'terminal.inspectProcess': {
        const terminal = worktrees[TerminalParam.parse(params).terminal]?.terminal
        if (!terminal || terminal.gone) {
          throw Object.assign(new Error('terminal_gone'), { code: 'terminal_gone' })
        }
        return {
          process: {
            foregroundProcess: terminal.foreground,
            hasChildProcesses: terminal.childProcessEvidence
              ? terminal.childProcessEvidence !== 'no-children'
              : false,
            ...(terminal.childProcessEvidence
              ? { childProcessEvidence: terminal.childProcessEvidence }
              : {})
          }
        }
      }
      case 'workspaceCleanup.scan': {
        await onScan()
        const ids = ScanParams.parse(params).worktreeIds
        return {
          candidates: ids
            .filter((wt) => worktrees[wt])
            .map((wt) => ({
              worktreeId: wt,
              blockers: worktrees[wt].blockers ?? [],
              git:
                worktrees[wt].atRiskLocalFiles === null
                  ? {}
                  : {
                      atRiskLocalFiles: worktrees[wt].atRiskLocalFiles ?? {
                        count: 0,
                        samplePaths: [],
                        complete: true
                      }
                    }
            }))
        }
      }
    }
    if (!worktrees[id]) {
      throw Object.assign(new Error('selector_not_found'), { code: 'selector_not_found' })
    }
    switch (method) {
      case 'worktree.show':
        return { worktree: { hostId } }
      case 'terminal.list':
        return {
          truncated: false,
          terminals: worktrees[id].terminal
            ? [{ handle: id, ptyId: 'pty_1', connected: true, tabId: 'tab_1', leafId: LEAF_ID }]
            : []
        }
      case 'worktree.rm':
        delete worktrees[id]
        return { removed: true }
    }
    throw new Error(`unexpected ${method}`)
  }
  return {
    rpc,
    calls,
    removals: () => calls.filter((call) => call.method === 'worktree.rm').map((call) => call.params)
  }
}

function completed(taskId: string): LiveTicket {
  return {
    taskId,
    runId: 'run_1',
    title: taskId,
    status: 'completed',
    result: 'done',
    completedAt: '2026-11-01T00:00:00.000Z',
    question: null,
    owner: null
  }
}

describe('ticket worktree cleanup', () => {
  let storeDir: string
  let store: TicketStore
  let clock: number
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-cleanup-')), 'store')
    store = createTicketStore(storeDir)
    clock = Date.parse('2026-11-21T12:00:00.000Z')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  const deps = (rpc: TmwkRpc, serverRpc = (_server: string, _timeoutMs: number) => rpc) =>
    ({ store, rpc, serverRpc, now: () => clock }) satisfies TicketWorktreeCleanupDeps

  /** A ticket whose attempts' Tasks all completed, then accepted. */
  async function acceptedTicket(
    attempts: { worktreeId: string; host?: string }[],
    { settle = true } = {}
  ) {
    const { ticket } = await store.create({ words: 'do it' })
    const taskIds = attempts.map((_, index) => `${ticket.id}-t${index}`)
    for (const [index, attempt] of attempts.entries()) {
      await store.attach(ticket.id, { ...attempt, taskId: taskIds[index], runId: 'run_1' })
    }
    if (settle) {
      await store.refresh(taskIds.map(completed))
    }
    await store.accept(ticket.id)
    return ticket.id
  }

  const pendingIds = async (id: string) =>
    (await store.show(id)).ticket.pendingWorktreeCleanup?.map((entry) => entry.worktreeId)

  it('removes a clean worktree with deleteBranch and hooks, without force', async () => {
    const home = fakeHost({ 'r1::/w/a': {} }, 'local')
    const id = await acceptedTicket([{ worktreeId: 'r1::/w/a' }])
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toEqual([
      {
        worktree: 'id:r1::/w/a',
        hostId: 'local',
        force: false,
        allowUnverifiedPtyStop: false,
        deleteBranch: true,
        runHooks: true,
        allowFailedArchiveHook: false,
        waitForBackgroundRemoval: true
      }
    ])
    expect(await pendingIds(id)).toBeUndefined()
  })

  it('removes a worktree whose only terminals are an idle shell or a finished agent', async () => {
    const home = fakeHost(
      {
        'r1::/w/shell': { terminal: { foreground: 'zsh', childProcessEvidence: 'no-children' } },
        'r1::/w/daemon-shell': {
          terminal: { foreground: null, childProcessEvidence: 'no-children' }
        },
        'r1::/w/done': {
          terminal: { foreground: 'claude', childProcessEvidence: 'children', agentState: 'done' }
        }
      },
      'local'
    )
    const id = await acceptedTicket([
      { worktreeId: 'r1::/w/shell' },
      { worktreeId: 'r1::/w/daemon-shell' },
      { worktreeId: 'r1::/w/done' }
    ])
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toMatchObject([
      { worktree: 'id:r1::/w/shell' },
      { worktree: 'id:r1::/w/daemon-shell' },
      { worktree: 'id:r1::/w/done' }
    ])
    expect(await pendingIds(id)).toBeUndefined()
  })

  it('keeps worktrees with work at risk, live terminals or agents, or open in a window, backed off', async () => {
    const worktrees: Record<string, FakeWorktree> = {
      'r1::/w/dirty': { blockers: ['dirty-files'] },
      'r1::/w/unpushed': { blockers: ['unpushed-commits'] },
      'r1::/w/ignored': { blockers: ['ignored-files'] },
      'r1::/w/busy-shell': { terminal: { foreground: 'npm', childProcessEvidence: 'children' } },
      'r1::/w/old-shell': { terminal: { foreground: 'zsh' } },
      'r1::/w/replaced': {
        terminal: { foreground: 'zsh', childProcessEvidence: 'no-children', gone: true }
      },
      'r1::/w/agent': { agentState: 'working' },
      'r1::/w/open': { active: true },
      'r1::/w/env': { atRiskLocalFiles: { count: 1, samplePaths: ['.env'], complete: true } },
      'r1::/w/old-host': { atRiskLocalFiles: null }
    }
    const home = fakeHost(worktrees, 'local')
    const id = await acceptedTicket(Object.keys(worktrees).map((worktreeId) => ({ worktreeId })))
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toEqual([])
    expect(await pendingIds(id)).toEqual([
      'r1::/w/dirty',
      'r1::/w/unpushed',
      'r1::/w/ignored',
      'r1::/w/busy-shell',
      'r1::/w/old-shell',
      'r1::/w/replaced',
      'r1::/w/agent',
      'r1::/w/open',
      'r1::/w/env',
      'r1::/w/old-host'
    ])

    worktrees['r1::/w/dirty'] = {}
    home.calls.length = 0
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.calls).toEqual([])

    clock += 61_000
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toMatchObject([{ worktree: 'id:r1::/w/dirty' }])
    expect(await pendingIds(id)).toEqual([
      'r1::/w/unpushed',
      'r1::/w/ignored',
      'r1::/w/busy-shell',
      'r1::/w/old-shell',
      'r1::/w/replaced',
      'r1::/w/agent',
      'r1::/w/open',
      'r1::/w/env',
      'r1::/w/old-host'
    ])
  })

  it('removes a paired server attempt on that server', async () => {
    const home = fakeHost({}, 'local')
    const server = fakeHost({ 'r2::/srv/a': {} }, 'srv-host')
    const routed = new Set<string>()
    const id = await acceptedTicket([{ worktreeId: 'r2::/srv/a', host: 'box' }])
    await cleanUpAcceptedWorktrees(
      deps(home.rpc, (name) => {
        routed.add(name)
        return server.rpc
      })
    )
    expect([...routed]).toEqual(['box'])
    expect(home.calls).toEqual([])
    expect(server.removals()).toMatchObject([{ worktree: 'id:r2::/srv/a', hostId: 'srv-host' }])
    expect(await pendingIds(id)).toBeUndefined()
  })

  it('does not clean up a ticket reopened by a new attempt', async () => {
    const home = fakeHost({ 'r1::/w/a': {}, 'r1::/w/b': {} }, 'local')
    const id = await acceptedTicket([{ worktreeId: 'r1::/w/a' }])
    await store.attach(id, { worktreeId: 'r1::/w/b' })
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.calls).toEqual([])
    expect(await pendingIds(id)).toBeUndefined()
  })

  it('stops when the ticket reopens before removal', async () => {
    let id = ''
    const home = fakeHost({ 'r1::/w/a': {} }, 'local', () =>
      store.attach(id, { worktreeId: 'r1::/w/b' })
    )
    id = await acceptedTicket([{ worktreeId: 'r1::/w/a' }])
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toEqual([])
  })

  it('leaves a worktree whose attempt has not settled', async () => {
    const home = fakeHost({ 'r1::/w/a': {} }, 'local')
    const id = await acceptedTicket([{ worktreeId: 'r1::/w/a' }], { settle: false })
    await cleanUpAcceptedWorktrees(deps(home.rpc))
    expect(home.removals()).toEqual([])
    expect(await pendingIds(id)).toEqual(['r1::/w/a'])
  })
})
