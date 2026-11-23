import { describe, expect, it } from 'vitest'
import { readWorktreeDeleteRisks } from './worktree-delete-risks'

type FakeWorktree = {
  scan?: 'fails' | { branch: string; blockers: string[]; upstreamAhead: number | null }
  agents?: { agentType: string; state: string }[]
  /** One connected terminal's foreground process and child census. */
  terminal?: { foreground: string; childProcessEvidence: string }
}

function fakeHost(worktree: FakeWorktree) {
  return async (method: string): Promise<unknown> => {
    switch (method) {
      case 'workspaceCleanup.scan': {
        if (worktree.scan === 'fails') {
          throw Object.assign(new Error('method not found'), { code: 'method_not_found' })
        }
        const scan = worktree.scan ?? { branch: 'wt', blockers: [], upstreamAhead: 0 }
        return {
          candidates: [
            {
              worktreeId: 'wt-1',
              branch: scan.branch,
              blockers: scan.blockers,
              git: { checkedAt: 1, upstreamAhead: scan.upstreamAhead }
            }
          ]
        }
      }
      case 'worktree.ps':
        return {
          truncated: false,
          worktrees: [
            {
              worktreeId: 'wt-1',
              liveTerminalCount: worktree.terminal ? 1 : 0,
              unverifiableTerminalCount: 0,
              isActive: true,
              agents: worktree.agents ?? []
            }
          ]
        }
      case 'terminal.list':
        return {
          truncated: false,
          terminals: worktree.terminal ? [{ handle: 't1', ptyId: 'pty-1', connected: true }] : []
        }
      case 'terminal.inspectProcess':
        return {
          process: {
            foregroundProcess: worktree.terminal?.foreground ?? null,
            hasChildProcesses: worktree.terminal?.childProcessEvidence === 'children',
            childProcessEvidence: worktree.terminal?.childProcessEvidence
          }
        }
    }
    throw new Error(`unexpected ${method}`)
  }
}

const TARGET = [{ worktreeId: 'wt-1', checkGit: true }]

describe('readWorktreeDeleteRisks', () => {
  it('names unpushed commits, a live agent and a background job', async () => {
    const read = fakeHost({
      scan: {
        branch: 'refs/heads/feature/x',
        blockers: ['unpushed-commits'],
        upstreamAhead: 11
      },
      agents: [{ agentType: 'claude', state: 'working' }],
      terminal: { foreground: 'zsh', childProcessEvidence: 'children' }
    })
    await expect(readWorktreeDeleteRisks(read, TARGET)).resolves.toEqual([
      [
        { kind: 'unpushed-commits', count: 11, branch: 'feature/x' },
        { kind: 'live-agents', count: 1, agentNames: ['Claude'] },
        { kind: 'running-terminals' }
      ]
    ])
  })

  it('finds nothing in a pushed, idle worktree whose agent finished', async () => {
    const read = fakeHost({
      agents: [{ agentType: 'claude', state: 'done' }],
      terminal: { foreground: 'zsh', childProcessEvidence: 'no-children' }
    })
    await expect(readWorktreeDeleteRisks(read, TARGET)).resolves.toEqual([[]])
  })

  it('reports commits as unknown when the host cannot scan', async () => {
    const read = fakeHost({ scan: 'fails' })
    await expect(readWorktreeDeleteRisks(read, TARGET)).resolves.toEqual([
      [{ kind: 'unknown', check: 'commits' }]
    ])
  })
})
