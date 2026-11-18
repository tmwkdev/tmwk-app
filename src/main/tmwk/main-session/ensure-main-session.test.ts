import { z } from 'zod'
import { mkdtemp, rm } from 'node:fs/promises'
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
        storeDir: join(root, 'store'),
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
    await rm(home.paths.sessionRecord)
    await ensureMainSession({ rpc, home, pickAgent: async () => 'gemini' })
    expect(rpc).toHaveBeenCalledWith(
      'agent.launch',
      expect.objectContaining({
        agent: 'gemini',
        prompt: { text: 'partner instructions', delivery: 'submit' }
      })
    )
  })
})
