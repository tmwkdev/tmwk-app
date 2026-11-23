import { z } from 'zod'
import { recognizeAgentProcess } from '../../agent-status/process/agent-process-recognition'
import { isShellProcess } from '../../agent-status/process/shell-process-detection'
import { isClientOnlyUnverifiableInspection } from '../../terminal/pty/lifecycle/terminal-process-inspection'

/** One runtime RPC read against the worktree's host; local and paired servers alike. */
export type WorktreeRuntimeRead = (method: string, params?: unknown) => Promise<unknown>

export type WorktreeTerminalActivity = 'idle' | 'running' | 'unknown'

const TERMINAL_LIST_LIMIT = 10_000

const TerminalList = z.object({
  truncated: z.boolean(),
  terminals: z.array(
    z.object({
      handle: z.string(),
      ptyId: z.string().nullable(),
      connected: z.boolean(),
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
function classify(inspection: ProcessInspection): WorktreeTerminalActivity {
  // An agent CLI idle at its prompt may still be owed a reply; it stays pending until the terminal closes.
  if (recognizeAgentProcess(inspection.foregroundProcess)) {
    return 'running'
  }
  const census = inspection.childProcessEvidence
  if (
    isClientOnlyUnverifiableInspection(inspection) ||
    census === undefined ||
    census === 'unverifiable'
  ) {
    return 'unknown'
  }
  const processName = inspection.foregroundProcess
  return census === 'no-children' && (!processName || isShellProcess(processName))
    ? 'idle'
    : 'running'
}

/** Whether any terminal worktree.rm would stop is doing work; any doubt reads as 'unknown'. */
export async function readWorktreeTerminalActivity(
  read: WorktreeRuntimeRead,
  worktreeId: string,
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
  if (
    listed.truncated ||
    listed.terminals.some(
      (t) => t.verdict === 'unverifiable' || (t.ptyId && !t.connected && t.verdict !== 'exited')
    )
  ) {
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
    const activity = classify(inspection)
    if (activity === 'running') {
      return 'running'
    }
    unknown ||= activity === 'unknown'
  }
  return unknown ? 'unknown' : 'idle'
}
