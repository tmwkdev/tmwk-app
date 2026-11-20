import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { MainHome } from '../main-home/ensure-main-home'
import { writeMainSessionPin } from '../main-session/main-session-pin'
import { openTmwkHealthStore } from './record-tmwk-health'

const rpc = vi.fn(async (method: string): Promise<unknown> => {
  throw new Error(`${method} unavailable`)
})

vi.mock('../main-session/tmwk-runtime-rpc', () => ({
  createTmwkRpc: () => rpc,
  createTmwkRuntimeClient: () => ({ rpc, subscribe: () => () => {} })
}))
vi.mock('../rollover/main-turn-in-flight', () => ({ hasTurnInFlight: async () => false }))

const { refreshTicketSnapshots } = await import('../tickets/refresh-ticket-snapshots')
const { requestSummaryRefresh } = await import('../summary/refresh-working-summary')
const { queueMainSessionRollover } = await import('../main-session/queue-main-session-replace')
const { replaceMainSession } = await import('../main-session/replace-main-session')

const pin = {
  sessionId: 'orca_session_id:current',
  agent: 'claude',
  createdAt: '2026-11-18T00:00:00Z'
}

async function recorded(): Promise<string[]> {
  const events = await openTmwkHealthStore().list()
  return events.flatMap((e) => (e.type === 'failure' ? [`${e.kind}/${e.stage}`] : []))
}

describe('tmwk failure sites', () => {
  let root: string
  let home: MainHome
  let runtime: OrcaRuntimeService
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-sites-'))
    vi.stubEnv('TMWK_HOME', root)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    home = {
      repoId: 'r1',
      worktreeId: 'r1::/main',
      prompt: 'partner',
      paths: {
        root,
        storeDir: join(root, 'store'),
        mainHome: join(root, 'main'),
        claudeMd: join(root, 'main', 'CLAUDE.md'),
        agentsMd: join(root, 'main', 'AGENTS.md'),
        sessionRecord: join(root, 'main-session.json')
      }
    }
    writeMainSessionPin(home.paths.sessionRecord, pin)
    runtime = {} as OrcaRuntimeService
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  it('records a failed ticket refresh', async () => {
    await refreshTicketSnapshots(runtime)
    await vi.waitFor(async () => expect(await recorded()).toEqual(['ticket-refresh/snapshot']))
  })

  it('records a failed summary refresh', async () => {
    await expect(requestSummaryRefresh(runtime, { force: true, reason: 'test' })).resolves.toEqual({
      outcome: 'failed'
    })
    await vi.waitFor(async () => expect(await recorded()).toEqual(['summary/refresh']))
  })

  it('records a rollover that fails because the chat changed', async () => {
    await queueMainSessionRollover({
      runtime,
      home,
      sessionId: 'orca_session_id:other',
      agent: 'claude'
    })
    await vi.waitFor(async () => expect(await recorded()).toEqual(['rollover/rollover']))
    const [event] = await openTmwkHealthStore().list()
    expect(event).toMatchObject({ code: 'session_changed' })
  })

  it('records a main session that cannot be replaced', async () => {
    await expect(
      replaceMainSession({ rpc, home, current: pin, agent: 'codex', reason: 'switch' })
    ).rejects.toThrow('previous chat is still pinned')
    await vi.waitFor(async () => expect(await recorded()).toEqual(['main-session/replace']))
  })
})
