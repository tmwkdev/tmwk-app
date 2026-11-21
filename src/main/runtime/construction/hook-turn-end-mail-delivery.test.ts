import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer } from '../../agent-hooks/server/agent-hook-server'
import { createRootDispatch } from '../orchestration/db/root-dispatch-test-fixture'
import {
  createDatabase,
  createRuntime,
  PANE_KEY,
  PTY_ID,
  pointerCount,
  TAB_ID,
  temporaryDirectories,
  TERMINAL_HANDLE,
  WORKTREE_ID
} from '../orchestration/mailbox/terminal-pointer/orchestration-mailbox-notification-test-harness'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

describe('hook turn end delivers mail to a terminal whose title shows no status', () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('types the Dispatch pointer once Codex reports its turn ended', async () => {
    const db = createDatabase('tmwk-hook-turn-end-mail-')
    const server = new AgentHookServer()
    const { runtime, write } = await createRuntime(db, {
      getAgentStatusSnapshot: () => server.getStatusSnapshot()
    })
    runtime.attachAgentStatusStore(server)
    const run = db.createRun({
      objective: 'Codex worker asked a question',
      coordinatorHandle: 'term_coordinator',
      coordinatorPaneKey: 'tab-coordinator:leaf-coordinator'
    })
    const task = db.createTask({ spec: 'Worker task', runId: run.id })
    const dispatch = createRootDispatch(db, task.id, TERMINAL_HANDLE, PANE_KEY)
    await runtime.listTerminals()
    runtime.onPtyData(PTY_ID, '\x1b]0;Delegate task to subagents | ci-back-to-green-mbp\x07', 1)
    await runtime.serializeMainTerminalBuffer(PTY_ID)

    const reply = db.insertMessage({
      from: 'term_coordinator',
      to: `dispatch:${dispatch.id}`,
      subject: 'Answer',
      type: 'status',
      runId: run.id
    })
    runtime.notifyMessageArrived(`dispatch:${dispatch.id}`, 'status')

    server.ingestTerminalStatus({
      paneKey: PANE_KEY,
      tabId: TAB_ID,
      worktreeId: WORKTREE_ID,
      terminalHandle: TERMINAL_HANDLE,
      payload: { state: 'done', prompt: '', agentType: 'codex' }
    })

    await vi.waitFor(() => expect(pointerCount(write)).toBe(1), { timeout: 2000 })
    await vi.waitFor(() => expect(db.getMessageById(reply.id)?.delivered_at).not.toBeNull(), {
      timeout: 2000
    })
    db.close()
  })
})
