import type {
  AgentPaneChange,
  AgentTransitionDetector
} from '../../agent-hooks/observations/agent-transition-detector'
import type { RuntimePtyWorktreeRecord } from '../../runtime/terminal/records/runtime-terminal-state-records'
import { OrcaRuntimeWithSetupTerminalAutoClose } from '../setup-terminal/runtime-setup-terminal-auto-close'

/** The runtime layer that lets a hook turn end stand in for a status-less title's idle and offer waiting mail.
 * It sits in the runtime class chain and reads protected members by name, so an upstream rename fails typecheck. */
export abstract class OrcaRuntimeWithHookTurnMail extends OrcaRuntimeWithSetupTerminalAutoClose {
  abstract readonly agentTransitions: AgentTransitionDetector

  /** The title observation each hook-borrowed idle stood on; any later title, or a reset, owns the status again. */
  private readonly hookIdleTitleAt = new WeakMap<RuntimePtyWorktreeRecord, number>()

  /** Upstream's worker auto-release observation, then tmwk's hook-turn mail; one subscription keeps the inherited constructor in budget. */
  protected observePaneWithHookTurnMail(change: AgentPaneChange): void {
    try {
      this.workerAutoReleaseActivity.observePane(change)
    } finally {
      this.followHookTurnForMail(change)
    }
  }

  /** tmwk: a title with no status glyph (Codex task titles) never shows rest, so the hook's turn end stands in for idle and offers waiting mail. */
  private followHookTurnForMail(change: AgentPaneChange): void {
    const pty = this.getPtyRecordForPaneKey(change.paneKey)
    const agent = pty && this.getPaneAgentForTuiIdle(pty.ptyId)
    const turn = agent ? this.readTuiIdleHookTurnForPty(pty.ptyId, agent)?.state : undefined
    if (!pty || !turn) {
      return
    }
    if (turn !== 'done') {
      if (this.hookIdleTitleAt.get(pty) === pty.lastOscTitleAt && pty.lastAgentStatus === 'idle') {
        this.setHookBorrowedStatus(pty, null)
      }
      this.hookIdleTitleAt.delete(pty)
      return
    }
    const row = this.agentTransitions.latestRow(change.paneKey)
    const endedAt = row ? (row.mainAgent?.stateStartedAt ?? row.stateStartedAt) : null
    // Why the turn's own clock: a done older than the last title (Codex exited to a shell) or replayed on a row rewrite is no turn end.
    if (
      change.kind === 'observed' &&
      pty.lastAgentStatusObservedLive &&
      pty.lastAgentStatus === null &&
      pty.lastOscTitleAt !== null &&
      pty.lastOscTitleEpochMs !== null &&
      endedAt !== null &&
      endedAt >= pty.lastOscTitleEpochMs
    ) {
      this.hookIdleTitleAt.set(pty, pty.lastOscTitleAt)
      this.setHookBorrowedStatus(pty, 'idle')
      this.deliverPendingMessagesForPty(pty.ptyId)
    }
  }

  private setHookBorrowedStatus(pty: RuntimePtyWorktreeRecord, status: 'idle' | null): void {
    const previous = pty.lastAgentStatus
    pty.lastAgentStatus = status
    for (const leaf of this.getLeavesForPty(pty.ptyId)) {
      if (leaf.lastAgentStatus === previous) {
        leaf.lastAgentStatus = status
      }
    }
    this.onTitleAgentStatusChanged()
    if (status === 'idle') {
      this.resolvePtyTuiIdleWaiters(pty, pty.ptyId)
    }
  }
}
