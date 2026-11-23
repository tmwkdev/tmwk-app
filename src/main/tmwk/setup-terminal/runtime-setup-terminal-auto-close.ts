import { OrcaRuntimeWithWindowlessTerminalActivity } from '../../runtime/sidebar-inputs/temporal/orca-runtime-windowless-terminal-activity'
import { createSetupTerminalAutoClose } from './setup-terminal-auto-close'
import { consumeSetupRunNonce } from './setup-run-nonces'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'

function worktreeHasStructuredChat(worktreeId: string): boolean {
  try {
    const store = getStructuredAgentSessionHost()?.deps.store
    // A closed chat keeps its record; only an open tab is a surface.
    return (store?.listVisibleSessionIds() ?? []).some(
      (sessionId) => store?.getConversation(sessionId)?.location.workspaceId === worktreeId
    )
  } catch {
    return false
  }
}

/** The runtime layer that closes a Setup terminal once its setup passes; a failed one keeps its output.
 * It sits in the runtime class chain and reads protected members by name, so an upstream rename fails typecheck. */
export abstract class OrcaRuntimeWithSetupTerminalAutoClose extends OrcaRuntimeWithWindowlessTerminalActivity {
  private readonly setupTerminalAutoClose = createSetupTerminalAutoClose({
    hasCompletionToken: (ptyId) => this.setupCompletionTokenByPtyId.has(ptyId),
    consumeRunNonce: (nonce) => consumeSetupRunNonce(nonce),
    hasChildProcesses: async (ptyId) =>
      (await this.ptyController?.hasChildProcesses?.(ptyId).catch(() => null)) ?? null,
    hasOtherSurfacesInWorktree: (ptyId) => {
      const worktreeId =
        this.ptysById.get(ptyId)?.worktreeId ?? this.getLeavesForPty(ptyId)[0]?.worktreeId
      if (!worktreeId) {
        return null
      }
      const panes = [...this.leaves.values()].filter((leaf) => leaf.worktreeId === worktreeId)
      // Main-created terminals no window shows yet have a PTY record but no leaf.
      const unshown = [...this.ptysById.values()].filter(
        (pty) =>
          pty.worktreeId === worktreeId &&
          pty.connected &&
          this.getLeavesForPty(pty.ptyId).length === 0
      )
      // A chat, file or browser tab is a surface too; the window publishes its tabs, chats live in the store.
      const tabs = this.mobileSessionTabsByWorktree.get(worktreeId)?.tabs ?? []
      return (
        [...panes, ...unshown].some((terminal) => terminal.ptyId !== ptyId) ||
        tabs.some((tab) => tab.type !== 'terminal') ||
        worktreeHasStructuredChat(worktreeId)
      )
    },
    lastUserInputAt: (ptyId) => this.terminalRunFacts.readLastDrivingInputAt(ptyId),
    resolveHandle: (ptyId) => {
      // A window-owned pane is a graph leaf; a pane main created is recorded on the PTY.
      const leaf = this.getLeavesForPty(ptyId).find((candidate) => candidate.connected)
      if (leaf) {
        return this.issueHandle(leaf)
      }
      const paneKey = this.paneOfPty(this.ptysById.get(ptyId)).paneKey
      return paneKey ? this.getTerminalHandleForPaneKey(paneKey) : null
    },
    closeTerminal: (handle) => this.closeTerminal(handle),
    subscribeToPtyExit: (ptyId, listener) => this.subscribeToPtyExit(ptyId, listener)
  })

  override onPtyData(
    ...args: Parameters<OrcaRuntimeWithWindowlessTerminalActivity['onPtyData']>
  ): number {
    const outputSequence = super.onPtyData(...args)
    this.setupTerminalAutoClose.observe(args[0], args[1])
    return outputSequence
  }

  override async waitForSetupTerminalCompletion(
    handle: string,
    signal?: AbortSignal
  ): Promise<{ exitCode: number | null }> {
    const { ptyId } = this.getTerminalPtyForHandle(handle).pty
    return await this.setupTerminalAutoClose.followSetupWait(
      ptyId,
      super.waitForSetupTerminalCompletion(handle, signal),
      () => this.setupCompletionTokenByPtyId.delete(ptyId)
    )
  }

  /** A reattached Setup terminal still idle after a passed setup closes too. */
  closeReattachedSetupTerminalIfIdle(ptyId: string, screen: string | undefined): void {
    this.setupTerminalAutoClose.checkReattached(ptyId, screen)
  }
}
