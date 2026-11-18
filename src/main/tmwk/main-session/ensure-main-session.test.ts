import { z } from 'zod'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureMainSession } from './ensure-main-session'
import { writeMainSessionPin } from './main-session-pin'
import { TmwkRpcError } from './tmwk-runtime-rpc'
import type { MainHome } from '../main-home/ensure-main-home'

const prior = {
  sessionId: 'orca_session_id:prior',
  agent: 'claude',
  createdAt: '2026-11-18T00:00:00Z'
}

describe('main session replacement', () => {
  let root: string
  let home: MainHome
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-session-'))
    home = {
      repoId: 'r1',
      worktreeId: 'r1::/main',
      prompt: 'partner instructions',
      paths: {
        root,
        mainHome: join(root, 'main'),
        claudeMd: join(root, 'main', 'CLAUDE.md'),
        agentsMd: join(root, 'main', 'AGENTS.md'),
        sessionRecord: join(root, 'main-session.json')
      }
    }
    writeMainSessionPin(home.paths.sessionRecord, prior)
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('pins Codex then Claude as fresh sessions, closing the previous chat without deleting history', async () => {
    let oldSessionId = prior.sessionId
    const rpc = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
      if (method === 'agent.launch') {
        const { sessionId } = z.object({ sessionId: z.string() }).parse(params)
        return { outcome: { kind: 'structured', sessionId } }
      }
      if (method === 'session.tabs.list') {
        return { tabs: [{ type: 'agent-session', sessionId: oldSessionId }] }
      }
      if (method === 'agentSession.close') {
        const pin = JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))
        expect(pin.sessionId).not.toBe(oldSessionId)
        expect(params).toEqual({ sessionId: oldSessionId })
        return { ok: true }
      }
      throw new Error(`Unexpected RPC: ${method}`)
    })
    const codex = await ensureMainSession({
      rpc,
      home,
      pickAgent: async () => 'claude',
      replaceWithAgent: 'codex'
    })
    expect(codex?.agent).toBe('codex')
    expect(codex?.sessionId).not.toBe(prior.sessionId)
    expect(JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))).toEqual(codex)
    oldSessionId = z.string().parse(codex?.sessionId)
    const claude = await ensureMainSession({
      rpc,
      home,
      pickAgent: async () => 'codex',
      replaceWithAgent: 'claude'
    })
    expect(claude?.agent).toBe('claude')
    expect(claude?.sessionId).not.toBe(codex?.sessionId)
    expect(JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))).toEqual(claude)
    expect(rpc).toHaveBeenCalledWith(
      'agent.launch',
      expect.objectContaining({
        agent: 'codex',
        target: { kind: 'existing', worktree: 'id:r1::/main' },
        surface: 'chat',
        presentation: 'background'
      })
    )
  })

  it('leaves the old pin intact when the replacement cannot launch', async () => {
    const rpc = async (): Promise<unknown> => {
      throw new Error('agent unavailable')
    }
    const result = await ensureMainSession({
      rpc,
      home,
      pickAgent: async () => null,
      replaceWithAgent: 'codex'
    })
    expect(result).toBeNull()
    expect(JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8'))).toEqual(prior)
  })

  it('restores the selected agent after restart even when the default differs', async () => {
    writeMainSessionPin(home.paths.sessionRecord, { ...prior, agent: 'codex' })
    const rpc = vi.fn(async (method: string): Promise<unknown> => {
      if (method === 'agent.launch') {
        throw new TmwkRpcError('runtime_error', 'agent_launch_session_already_exists')
      }
      return { tabs: [] }
    })
    const restored = await ensureMainSession({ rpc, home, pickAgent: async () => 'claude' })
    expect(restored).toEqual({ ...prior, agent: 'codex' })
    expect(rpc).toHaveBeenCalledWith(
      'agent.launch',
      expect.objectContaining({ agent: 'codex', sessionId: prior.sessionId })
    )
  })

  it('delivers the partner prompt as the first turn to agents without file transports', async () => {
    const rpc = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
      if (method === 'agent.launch') {
        const { sessionId } = z.object({ sessionId: z.string() }).parse(params)
        return { outcome: { kind: 'structured', sessionId }, prompt: { outcome: 'journaled' } }
      }
      return { tabs: [] }
    })
    await ensureMainSession({ rpc, home, pickAgent: async () => null, replaceWithAgent: 'gemini' })
    expect(rpc).toHaveBeenCalledWith(
      'agent.launch',
      expect.objectContaining({
        agent: 'gemini',
        prompt: { text: 'partner instructions', delivery: 'submit' }
      })
    )
  })
})
