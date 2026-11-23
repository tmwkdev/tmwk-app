import { z } from 'zod'
import { WORKTREE_REMOVE_BRANCH_POLICY_RUNTIME_CAPABILITY } from '../../../shared/remote-runtime/protocol/worktree-runtime-capabilities'
import type {
  TmwkPendingWorktreeCleanup,
  TmwkTicketRecord
} from '../../../shared/tmwk/tmwk-ticket-record'
import { shortRefLabel } from '../../../shared/source-control/short-ref-label'
import type { WorkspaceCleanupBlocker } from '../../../shared/workspace-cleanup/workspace-cleanup'
import { worktreeRemovalReplyTimeoutMs } from '../../../shared/worktree/removal/archive-hook-removal-gate'
import { hasWorktreeAtRiskLocalFiles } from '../../../shared/worktree/removal/at-risk-local-files'
import {
  WORKTREE_PS_LIMIT,
  WorkspaceCleanupScan as Scan,
  WorktreePs as Ps,
  type WorktreePsRows as PsRows
} from '../../../shared/tmwk/worktree/worktree-runtime-read-schemas'
import { readWorktreeTerminalActivity } from '../../../shared/tmwk/worktree/worktree-terminal-activity'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import {
  sameWorktree,
  settlePendingWorktrees,
  type WorktreeCleanupOutcome
} from './ticket-acceptance'
import type { TicketStore } from './ticket-store'
import { errorCode, isServerLinkFailure } from './server-link-failure'

export type TicketWorktreeCleanupDeps = {
  store: Pick<TicketStore, 'records' | 'amend'>
  rpc: TmwkRpc
  serverRpc: (server: string, timeoutMs: number) => TmwkRpc
  now?: () => number
}

const WORKTREE_CLEANUP_READ_TIMEOUT_MS = 5000
const REMOVAL_TIMEOUT_MS = worktreeRemovalReplyTimeoutMs(true)

const WorktreeShow = z.object({
  worktree: z.object({
    hostId: z.string().nullish(),
    git: z.object({ branch: z.string().nullish() }).optional()
  })
})
const Status = z.object({ capabilities: z.array(z.string()).optional() })
const Removal = z.object({ removed: z.boolean().optional() })

// Orca never removes these; there is nothing for accept to clean up.
const NEVER_REMOVABLE: ReadonlySet<string> = new Set<WorkspaceCleanupBlocker>([
  'main-worktree',
  'folder-repo'
])

// Cleanup-suggestion signals, not work at risk; every other blocker (including unknown ones) keeps it.
const NOT_BLOCKING: ReadonlySet<string> = new Set<WorkspaceCleanupBlocker>([
  'pinned',
  'recent-visible-context',
  'active-workspace',
  'dismissed'
])

const running = new Set<string>()

/** One host for one run: status read once; a transport failure skips the host after. */
function openHost(deps: TicketWorktreeCleanupDeps, host: string | undefined) {
  const read = host ? deps.serverRpc(host, WORKTREE_CLEANUP_READ_TIMEOUT_MS) : deps.rpc
  const remove = host ? deps.serverRpc(host, REMOVAL_TIMEOUT_MS) : deps.rpc
  let down = false
  const call = (rpc: TmwkRpc) => async (method: string, params?: unknown) => {
    try {
      return await rpc(method, params)
    } catch (error) {
      down ||= isServerLinkFailure(error)
      throw error
    }
  }
  const session = { read: call(read), remove: call(remove), isDown: () => down }
  let branchPolicy: Promise<boolean> | undefined
  return {
    ...session,
    // An older host ignores deleteBranch and applies its own branch policy.
    honorsDeleteBranch: () =>
      (branchPolicy ??= session
        .read('status.get')
        .then((status) =>
          Boolean(
            Status.parse(status).capabilities?.includes(
              WORKTREE_REMOVE_BRANCH_POLICY_RUNTIME_CAPABILITY
            )
          )
        )
        .catch(() => {
          down = true
          return false
        })),
    /** The worktree's rows now, read per entry so liveness is fresh right before removal. */
    psRows: async (worktreeId: string): Promise<PsRows> =>
      Ps.parse(await session.read('worktree.ps', { limit: WORKTREE_PS_LIMIT })).worktrees.filter(
        (row) => row.worktreeId === worktreeId
      )
  }
}

type Host = ReturnType<typeof openHost>

function isIdle(rows: PsRows): boolean {
  return (
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.unverifiableTerminalCount === 0 &&
        // Open in a host window or phone; covers unsaved drafts in this worktree only.
        row.isActive === false &&
        // Any agent row blocks: one idle at its prompt may still be owed a reply.
        row.agents.length === 0
    )
  )
}

/** No agent or running terminal now; idle shells may go, as worktree.rm stops them. */
async function hasNothingRunning(host: Host, worktreeId: string): Promise<boolean> {
  const rows = await host.psRows(worktreeId)
  if (!isIdle(rows)) {
    return false
  }
  const liveTerminalCount = Math.max(...rows.map((row) => row.liveTerminalCount))
  return (await readWorktreeTerminalActivity(host.read, worktreeId, liveTerminalCount)) === 'idle'
}

/** True once the worktree is gone: removed now, already missing, or never removable. */
async function removeWhenSafe(
  host: Host,
  worktreeId: string,
  stillDue: (branch: string | undefined) => Promise<boolean>
): Promise<boolean> {
  const worktree = `id:${worktreeId}`
  if (!(await host.honorsDeleteBranch())) {
    return false
  }
  let shown: z.infer<typeof WorktreeShow>['worktree']
  try {
    shown = WorktreeShow.parse(await host.read('worktree.show', { worktree })).worktree
  } catch (error) {
    return errorCode(error) === 'selector_not_found'
  }
  if (!shown.hostId) {
    return false
  }
  const { candidates } = Scan.parse(
    await host.read('workspaceCleanup.scan', { worktreeIds: [worktreeId] })
  )
  const candidate = candidates.find((entry) => entry.worktreeId === worktreeId)
  if (candidate?.blockers.some((blocker) => NEVER_REMOVABLE.has(blocker))) {
    return true
  }
  // Hosts before the ignored-files blocker omit this; unknown local files are kept.
  const atRisk = candidate?.git?.atRiskLocalFiles
  if (
    !candidate ||
    !atRisk ||
    hasWorktreeAtRiskLocalFiles(atRisk) ||
    candidate.blockers.some((blocker) => !NOT_BLOCKING.has(blocker)) ||
    !(await hasNothingRunning(host, worktreeId)) ||
    !(await stillDue(shown.git?.branch ? shortRefLabel(shown.git.branch) : undefined))
  ) {
    return false
  }
  const removal = Removal.parse(
    await host.remove('worktree.rm', {
      worktree,
      hostId: shown.hostId,
      force: false,
      allowUnverifiedPtyStop: false,
      deleteBranch: true,
      runHooks: true,
      allowFailedArchiveHook: false,
      waitForBackgroundRemoval: true
    })
  )
  return removal.removed === true
}

/** An unaccepted ticket or unsettled attempt uses it: by id, else by host and branch; a reused worktree may record no id. */
function isBusy(
  records: readonly TmwkTicketRecord[],
  entry: TmwkPendingWorktreeCleanup,
  branch: string | undefined
): boolean {
  return records.some((record) =>
    record.attempts.some(
      (attempt) =>
        (record.status !== 'accepted' || attempt.settledAt === undefined) &&
        (attempt.worktreeId
          ? attempt.worktreeId === entry.worktreeId
          : (attempt.host ?? '') === (entry.host ?? '') &&
            (attempt.branch
              ? !branch || shortRefLabel(attempt.branch) === branch
              : !attempt.settledAt))
    )
  )
}

async function cleanUpTicket(
  deps: TicketWorktreeCleanupDeps,
  hostFor: (host: string | undefined) => Host,
  record: TmwkTicketRecord,
  due: readonly TmwkPendingWorktreeCleanup[]
): Promise<WorktreeCleanupOutcome[]> {
  const outcomes: WorktreeCleanupOutcome[] = []
  let reopened = false
  // Re-read right before removing: the ticket may have reopened, or another attempt taken the worktree.
  const stillDue = (entry: TmwkPendingWorktreeCleanup) => async (branch: string | undefined) => {
    const { records } = await deps.store.records()
    const current = records.find((r) => r.id === record.id)
    reopened =
      current?.status !== 'accepted' ||
      !current.pendingWorktreeCleanup?.some((pending) => sameWorktree(pending, entry))
    return !reopened && !isBusy(records, entry, branch)
  }
  for (const entry of due) {
    const host = hostFor(entry.host)
    // A refusal, an unreachable server or any other failure leaves it pending, backed off.
    const removed =
      !host.isDown() &&
      (await removeWhenSafe(host, entry.worktreeId, stillDue(entry)).catch(() => false))
    if (reopened) {
      break
    }
    outcomes.push({ entry, removed })
  }
  return outcomes
}

/** Tries the due pending worktrees of accepted tickets (or just `ticketId`'s); one run per ticket at a time. */
export async function cleanUpAcceptedWorktrees(
  deps: TicketWorktreeCleanupDeps,
  ticketId?: string
): Promise<void> {
  const now = deps.now ?? Date.now
  const { records } = await deps.store.records()
  const hosts = new Map<string, Host>()
  const hostFor = (host: string | undefined) => {
    const key = host ?? ''
    let opened = hosts.get(key)
    if (!opened) {
      opened = openHost(deps, host)
      hosts.set(key, opened)
    }
    return opened
  }
  const start = now()
  const claimed = records.flatMap((record) => {
    const due = (record.pendingWorktreeCleanup ?? []).filter(
      (entry) => !entry.nextAttemptAt || Date.parse(entry.nextAttemptAt) <= start
    )
    if (
      record.status !== 'accepted' ||
      due.length === 0 ||
      (ticketId !== undefined && record.id !== ticketId) ||
      running.has(record.id)
    ) {
      return []
    }
    running.add(record.id)
    return [{ record, due }]
  })
  try {
    for (const { record, due } of claimed) {
      const outcomes = await cleanUpTicket(deps, hostFor, record, due)
      if (outcomes.length > 0) {
        await deps.store.amend(record.id, (current) =>
          settlePendingWorktrees(current, outcomes, now())
        )
      }
      running.delete(record.id)
    }
  } finally {
    for (const { record } of claimed) {
      running.delete(record.id)
    }
  }
}
