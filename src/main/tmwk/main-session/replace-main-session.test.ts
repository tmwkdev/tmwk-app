import { z } from 'zod'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { replaceMainSession } from './replace-main-session'
import { writeMainSessionPin } from './main-session-pin'
import type { MainHome } from '../main-home/ensure-main-home'

const older = {
  sessionId: 'orca_session_id:older',
  agent: 'codex',
  createdAt: '2026-11-17T00:00:00Z',
  endedAt: '2026-11-18T00:00:00Z',
  reason: 'switch' as const
}
const current = {
  sessionId: 'orca_session_id:current',
  agent: 'claude',
  createdAt: '2026-11-18T00:00:00Z',
  previous: [older],
  briefedAt: '2026-11-18T00:00:01Z'
}

describe('main session replacement', () => {
  let root: string
  let home: MainHome
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-replace-'))
    vi.stubEnv('TMWK_HOME', root)
    home = {
      repoId: 'r1',
      worktreeId: 'r1::/main',
      prompt: 'partner instructions',
      paths: {
        root,
        storeDir: join(root, 'store'),
        mainHome: join(root, 'main'),
        claudeMd: join(root, 'main', 'CLAUDE.md'),
        agentsMd: join(root, 'main', 'AGENTS.md'),
        sessionRecord: join(root, 'main-session.json')
      }
    }
    writeMainSessionPin(home.paths.sessionRecord, current)
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(root, { recursive: true, force: true })
  })

  it('Same-agent rollover pins a new session before closing the old one', async () => {
    const calls: string[] = []
    const rpc = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
      calls.push(method)
      if (method === 'agent.launch') {
        const { sessionId } = z.object({ sessionId: z.string() }).parse(params)
        return { outcome: { kind: 'structured', sessionId } }
      }
      if (method === 'session.tabs.list') {
        return { tabs: [{ type: 'agent-session', sessionId: current.sessionId }] }
      }
      if (method === 'agentSession.close') {
        const pin = JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))
        expect(pin.sessionId).not.toBe(current.sessionId)
        return { ok: true }
      }
      if (method === 'orchestration.send') {
        return {}
      }
      throw new Error(`Unexpected RPC: ${method}`)
    })
    const pin = await replaceMainSession({
      rpc,
      home,
      current,
      agent: 'claude',
      reason: 'rollover'
    })
    expect(calls.indexOf('agent.launch')).toBeLessThan(calls.indexOf('agentSession.close'))
    expect(pin.agent).toBe('claude')
    expect(pin.sessionId).not.toBe(current.sessionId)
    expect(pin.previous).toEqual([
      {
        sessionId: current.sessionId,
        agent: 'claude',
        createdAt: current.createdAt,
        endedAt: expect.any(String),
        reason: 'rollover'
      },
      older
    ])
    expect(JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))).toEqual(pin)
    expect(pin.briefedAt).toEqual(expect.any(String))
  })
})
