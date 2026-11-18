import { z } from 'zod'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureMainSession } from './ensure-main-session'
import { TmwkRpcError } from './tmwk-runtime-rpc'
import type { MainHome } from '../main-home/ensure-main-home'

describe('ensureMainSession', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-session-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reuses the pinned session on a second run', async () => {
    const home: MainHome = {
      repoId: 'r1',
      worktreeId: 'r1::/main',
      prompt: 'prompt',
      paths: {
        root,
        mainHome: join(root, 'main'),
        claudeMd: join(root, 'main', 'CLAUDE.md'),
        agentsMd: join(root, 'main', 'AGENTS.md'),
        sessionRecord: join(root, 'main-session.json')
      }
    }
    const live = new Set<string>()
    const launches: string[] = []
    const rpc = async (method: string, params?: unknown): Promise<unknown> => {
      if (method === 'agent.launch') {
        const { sessionId } = z.object({ sessionId: z.string() }).parse(params)
        launches.push(sessionId)
        if (live.has(sessionId)) {
          throw new TmwkRpcError('runtime_error', 'agent_launch_session_already_exists')
        }
        live.add(sessionId)
        return {}
      }
      return { tabs: [] }
    }
    const pickAgent = async (): Promise<string> => 'claude'

    const first = await ensureMainSession({ rpc, home, pickAgent })
    const second = await ensureMainSession({ rpc, home, pickAgent })

    expect(second?.sessionId).toBe(first?.sessionId)
    expect(live.size).toBe(1)
    expect(launches).toHaveLength(2)
    expect(JSON.parse(await readFile(home.paths.sessionRecord, 'utf-8')).agent).toBe('claude')
  })
})
