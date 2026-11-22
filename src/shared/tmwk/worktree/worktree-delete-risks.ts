import { z } from 'zod'
import { LOCAL_EXECUTION_HOST_ID } from '../../execution-host/execution-host'
import { formatAgentTypeLabel } from '../../agent-status/presentation/agent-type-label'
import { shortRefLabel } from '../../source-control/short-ref-label'
import {
  isWorkspaceCleanupHeadLanded,
  type WorkspaceCleanupBlocker,
  type WorkspaceCleanupMergeEvidence,
  WORKSPACE_CLEANUP_TARGET_BATCH_LIMIT
} from '../../workspace-cleanup/workspace-cleanup'
import {
  WORKTREE_PS_LIMIT,
  WorkspaceCleanupScan,
  WorktreePs,
  type WorktreePsRows
} from './worktree-runtime-read-schemas'
import {
  readWorktreeTerminalActivity,
  type WorktreeRuntimeRead
} from './worktree-terminal-activity'

/** Work that deleting a worktree would lose; `unknown` names a check that could not prove it safe. */
export type WorktreeDeleteRisk =
  | { kind: 'unpushed-commits'; count: number | null; branch: string | null }
  | { kind: 'live-agents'; count: number; agentNames: string[] }
  | { kind: 'running-terminals' }
  | { kind: 'unknown'; check: 'commits' | 'agents' | 'terminals' }

const NOT_A_GIT_WORKTREE: ReadonlySet<string> = new Set<WorkspaceCleanupBlocker>([
  'main-worktree',
  'folder-repo'
])

// The scan could not read the commits, so none are proven pushed.
const COMMITS_UNREAD: ReadonlySet<string> = new Set<WorkspaceCleanupBlocker>([
  'git-status-error',
  'unknown-base',
  'ssh-disconnected'
])

// ps keeps a finished agent's row while its pane lives. Staleness is not checked: the row's clock is the host's.
const AgentRow = z.object({ agentType: z.string().nullish(), state: z.string() })

/** One worktree on the host `read` reaches; `hostId` is the id that host lists it under, if known. */
export type WorktreeDeleteTarget = { worktreeId: string; hostId?: string; checkGit: boolean }

const UNKNOWN_COMMITS: WorktreeDeleteRisk[] = [{ kind: 'unknown', check: 'commits' }]
const UNKNOWN_WORK: WorktreeDeleteRisk[] = [
  { kind: 'unknown', check: 'agents' },
  { kind: 'unknown', check: 'terminals' }
]

type ScanCandidate = z.infer<typeof WorkspaceCleanupScan>['candidates'][number]

function commitRisks(candidate: ScanCandidate | undefined): WorktreeDeleteRisk[] {
  if (candidate?.blockers.some((blocker) => NOT_A_GIT_WORKTREE.has(blocker))) {
    return []
  }
  if (candidate?.blockers.includes('unpushed-commits')) {
    const ahead = candidate.git?.upstreamAhead
    return [
      {
        kind: 'unpushed-commits',
        count: ahead && ahead > 0 ? ahead : null,
        branch: candidate.branch ? shortRefLabel(candidate.branch) : null
      }
    ]
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the schema parses every field isWorkspaceCleanupHeadLanded reads.
  const merge = candidate?.git?.merge as WorkspaceCleanupMergeEvidence | undefined
  // The scan checks remotes only for a clean tree; a dirty one with no upstream is unproven.
  const dirtyWithoutUpstream =
    candidate?.blockers.includes('dirty-files') &&
    candidate.git?.upstreamAhead == null &&
    !isWorkspaceCleanupHeadLanded(merge)
  if (
    !candidate?.git?.checkedAt ||
    dirtyWithoutUpstream ||
    candidate.blockers.some((blocker) => COMMITS_UNREAD.has(blocker))
  ) {
    return UNKNOWN_COMMITS
  }
  return []
}

/** The id a host lists a row under; rows without one are its own. */
function listedHost(hostId: string | null | undefined): string {
  return hostId ?? LOCAL_EXECUTION_HOST_ID
}

/** The target's own row among those sharing its id; same-id twins (SSH) are told apart by host. */
function ownRows<T>(
  rows: readonly T[],
  target: WorktreeDeleteTarget,
  hostOf: (row: T) => string | null | undefined
): T[] {
  return new Set(rows.map((row) => listedHost(hostOf(row)))).size > 1
    ? rows.filter((row) => listedHost(hostOf(row)) === listedHost(target.hostId))
    : [...rows]
}

/** One scan per batch of worktree ids; a failed batch leaves its targets unproven. */
async function readCommitRisks(
  read: WorktreeRuntimeRead,
  targets: readonly WorktreeDeleteTarget[]
): Promise<Map<WorktreeDeleteTarget, WorktreeDeleteRisk[]>> {
  const ids = [...new Set(targets.map((target) => target.worktreeId))]
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += WORKSPACE_CLEANUP_TARGET_BATCH_LIMIT) {
    batches.push(ids.slice(i, i + WORKSPACE_CLEANUP_TARGET_BATCH_LIMIT))
  }
  const scanned = await Promise.all(
    batches.map((batch) =>
      read('workspaceCleanup.scan', { worktreeIds: batch })
        .then((result) => ({ batch, candidates: WorkspaceCleanupScan.parse(result).candidates }))
        .catch(() => ({ batch, candidates: null }))
    )
  )
  const failedIds = new Set(scanned.flatMap((scan) => (scan.candidates ? [] : scan.batch)))
  const candidates = scanned.flatMap((scan) => scan.candidates ?? [])
  return new Map(
    targets.map((target) => {
      if (failedIds.has(target.worktreeId)) {
        return [target, UNKNOWN_COMMITS]
      }
      const own = ownRows(
        candidates.filter((entry) => entry.worktreeId === target.worktreeId),
        target,
        (entry) => entry.executionHostId
      )
      // No candidate for this host: nothing proves its commits pushed.
      return [target, own.length === 1 ? commitRisks(own[0]) : UNKNOWN_COMMITS]
    })
  )
}

function agentRisk(rows: WorktreePsRows): WorktreeDeleteRisk | null {
  const live = rows.flatMap((row) =>
    row.agents.flatMap((agent) => {
      const parsed = AgentRow.safeParse(agent).data
      // A row this host cannot describe is not proof it is finished.
      return !parsed || parsed.state !== 'done' ? [parsed] : []
    })
  )
  if (live.length === 0) {
    return null
  }
  const names = live.flatMap((agent) =>
    agent?.agentType && agent.agentType !== 'unknown' ? [formatAgentTypeLabel(agent.agentType)] : []
  )
  return { kind: 'live-agents', count: live.length, agentNames: [...new Set(names)] }
}

async function readWorkRisks(
  read: WorktreeRuntimeRead,
  worktreeId: string,
  rows: WorktreePsRows
): Promise<WorktreeDeleteRisk[]> {
  if (rows.length === 0) {
    return UNKNOWN_WORK
  }
  const risks: WorktreeDeleteRisk[] = []
  const agents = agentRisk(rows)
  if (agents) {
    risks.push(agents)
  }
  // Old hosts omit the lost-contact count; that is not proof none exist.
  if (rows.some((row) => row.unverifiableTerminalCount !== 0)) {
    risks.push({ kind: 'unknown', check: 'terminals' })
    return risks
  }
  const liveTerminalCount = Math.max(...rows.map((row) => row.liveTerminalCount))
  const activity = await readWorktreeTerminalActivity(read, worktreeId, liveTerminalCount).catch(
    () => 'unknown' as const
  )
  if (activity === 'running') {
    risks.push({ kind: 'running-terminals' })
  } else if (activity === 'unknown') {
    risks.push({ kind: 'unknown', check: 'terminals' })
  }
  return risks
}

/** What deleting each target on one host would lose, in order; every failed read is `unknown`, never safe. */
export async function readWorktreeDeleteRisks(
  read: WorktreeRuntimeRead,
  targets: readonly WorktreeDeleteTarget[]
): Promise<WorktreeDeleteRisk[][]> {
  const [commits, psRows] = await Promise.all([
    readCommitRisks(
      read,
      targets.filter((target) => target.checkGit)
    ),
    read('worktree.ps', { limit: WORKTREE_PS_LIMIT })
      .then((result) => WorktreePs.parse(result).worktrees)
      .catch(() => null)
  ])
  return Promise.all(
    targets.map(async (target) => {
      const rows =
        psRows &&
        ownRows(
          psRows.filter((row) => row.worktreeId === target.worktreeId),
          target,
          (row) => row.hostId
        )
      const work = rows ? await readWorkRisks(read, target.worktreeId, rows) : UNKNOWN_WORK
      return [...(commits.get(target) ?? []), ...work]
    })
  )
}
