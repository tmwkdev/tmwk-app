import { z } from 'zod'
import { recognizeAgentProcess } from '../../../shared/agent-status/process/agent-process-recognition'
import { isShellProcess } from '../../../shared/agent-status/process/shell-process-detection'
import { isClientOnlyUnverifiableInspection } from '../../../shared/terminal/pty/lifecycle/terminal-process-inspection'
import { isTerminalLeafId, makePaneKey } from '../../../shared/workspace-layout/stable-pane-id'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

export type WorktreeTerminalActivity = 'idle' | 'running' | 'unknown'

const TERMINAL_LIST_LIMIT = 10_000

const TerminalList = z.object({
  truncated: z.boolean(),
  terminals: z.array(
    z.object({
      handle: z.string(),
      ptyId: z.string().nullable(),
      connected: z.boolean(),
      tabId: z.string(),
      leafId: z.string(),
      verdict: z.string().optional()
    })
  )
})

const Inspection = z.object({
  process: z.object({
    foregroundProcess: z.string().nullable(),
    hasChildProcesses: z.boolean(),
    childProcessEvidence: z.string().optional(),
    verdict: z.string().optional()
  })
})

type ProcessInspection = z.infer<typeof Inspection>['process']

/**
 * Orca's cleanup runner rule (workspace-cleanup-terminal-activity.ts), stricter: only an explicit
 * no-children census proves a shell idle, since older hosts collapse failed inspection into false.
 */
function classify(
  inspection: ProcessInspection,
  paneAgentState: string | undefined
): WorktreeTerminalActivity {
  const census = inspection.childProcessEvidence
  if (
    isClientOnlyUnverifiableInspection(inspection) ||
    census === undefined ||
    census === 'unverifiable'
  ) {
    return 'unknown'
  }
  const processName = inspection.foregroundProcess
  if (census === 'no-children' && (!processName || isShellProcess(processName))) {
    return 'idle'
  }
  // An agent CLI at its prompt keeps helper children; only its pane's finished turn proves it idle.
  return recognizeAgentProcess(processName) && paneAgentState === 'done' ? 'idle' : 'running'
}

/** Whether any terminal worktree.rm would stop is doing work; any doubt reads as 'unknown'. */
export async function readWorktreeTerminalActivity(
  read: TmwkRpc,
  worktreeId: string,
  paneAgentStates: ReadonlyMap<string, string>,
  liveTerminalCount: number
): Promise<WorktreeTerminalActivity> {
  const listed = TerminalList.parse(
    await read('terminal.list', {
      worktree: `id:${worktreeId}`,
      limit: TERMINAL_LIST_LIMIT,
      requireFreshPtyLiveness: true,
      includePreview: false,
      includeVisualLayouts: false
    })
  )
  if (listed.truncated || listed.terminals.some((t) => t.verdict === 'unverifiable')) {
    return 'unknown'
  }
  const ptyBacked = listed.terminals.filter((t) => t.ptyId && t.connected)
  // Sessions no window reattached since a relaunch are counted but not listed; removal stops them too.
  if (liveTerminalCount > ptyBacked.length) {
    return 'unknown'
  }
  let unknown = false
  for (const terminal of ptyBacked) {
    let inspection: ProcessInspection
    try {
      inspection = Inspection.parse(
        await read('terminal.inspectProcess', {
          terminal: terminal.handle,
          scanChildProcesses: true
        })
      ).process
    } catch {
      // Includes terminal_gone: the handle's leaf may have been replaced, not its process exited.
      unknown = true
      continue
    }
    const paneKey = isTerminalLeafId(terminal.leafId)
      ? makePaneKey(terminal.tabId, terminal.leafId)
      : undefined
    const activity = classify(inspection, paneKey ? paneAgentStates.get(paneKey) : undefined)
    if (activity === 'running') {
      return 'running'
    }
    unknown ||= activity === 'unknown'
  }
  return unknown ? 'unknown' : 'idle'
}
