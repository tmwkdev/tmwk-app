import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { getWorktreeIdsWithLiveAgent } from '@/lib/workspace/activity/worktree-activity-state'
import { getIndexedAllWorktrees } from '@/store/slices/worktrees/listing/worktree-catalog-index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { resolveDeleteTargetGitContext } from '@/components/sidebar/workspace-actions/deletion/use-delete-worktree-status-hydration'
import { isFolderWorkspaceDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-dialog-copy'
import { waitForPromiseWithSignal } from '../../../../shared/concurrency/abort-signal-reason'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  readWorktreeDeleteRisks,
  type WorktreeDeleteRisk
} from '../../../../shared/tmwk/worktree/worktree-delete-risks'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'

export type TmwkDeleteWorktreeRiskEntry = {
  worktree: Worktree
  risks: WorktreeDeleteRisk[]
}

/** One bound for every read of one check; a read still pending then counts as unknown. */
const DELETE_RISK_CHECK_TIMEOUT_MS = 10_000

const UNKNOWN_WORK: WorktreeDeleteRisk[] = [
  { kind: 'unknown', check: 'agents' },
  { kind: 'unknown', check: 'terminals' }
]

function isGitWorktree(worktree: Worktree): boolean {
  const repoMap = new Map(useAppStore.getState().repos.map((repo) => [repo.id, repo]))
  return !isFolderWorkspaceDelete(repoMap, worktree)
}

/** Every check this worktree needs, unproven: its host cannot be reached or the check failed. */
export function uncheckedDeleteRisks(worktree: Worktree): WorktreeDeleteRisk[] {
  return isGitWorktree(worktree)
    ? [{ kind: 'unknown', check: 'commits' }, ...UNKNOWN_WORK]
    : UNKNOWN_WORK
}

type HostGroup = { target: RuntimeClientTarget | null; worktrees: Worktree[] }

function groupByHost(worktrees: readonly Worktree[]): HostGroup[] {
  const { repos } = useAppStore.getState()
  const groups = new Map<string, HostGroup>()
  for (const worktree of worktrees) {
    const target = resolveDeleteTargetGitContext(worktree, repos)?.target ?? null
    const key = target ? JSON.stringify(target) : `unreachable:${worktree.hostId ?? ''}`
    const group = groups.get(key) ?? { target, worktrees: [] }
    group.worktrees.push(worktree)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** A paired server lists its own worktrees as local; this window's host lists them as the window does. */
function hostIdOnTarget(worktree: Worktree, target: RuntimeClientTarget): string | undefined {
  return target.kind === 'environment' ? LOCAL_EXECUTION_HOST_ID : worktree.hostId
}

async function readGroupRisks(
  group: HostGroup,
  signal: AbortSignal,
  deadline: number
): Promise<WorktreeDeleteRisk[][]> {
  const { target } = group
  if (!target) {
    return group.worktrees.map(uncheckedDeleteRisks)
  }
  return readWorktreeDeleteRisks(
    (method, params) =>
      waitForPromiseWithSignal(
        callRuntimeRpc(target, method, params, {
          timeoutMs: Math.max(1, deadline - Date.now()),
          signal
        }),
        signal
      ),
    group.worktrees.map((worktree) => ({
      worktreeId: worktree.id,
      hostId: hostIdOnTarget(worktree, target),
      checkGit: isGitWorktree(worktree)
    }))
  )
}

/** This window's live agents, for ids no other host's worktree shares (the store keys agents by id alone). */
function liveAgentInWindow(): (worktree: Worktree) => boolean {
  const state = useAppStore.getState()
  const live = getWorktreeIdsWithLiveAgent(
    state.agentStatusByPaneKey,
    state.tabsByWorktree,
    Date.now()
  )
  const hostsById = new Map<string, Set<string>>()
  for (const worktree of getIndexedAllWorktrees(selectWorktreesByRepo(state))) {
    const hosts = hostsById.get(worktree.id) ?? new Set()
    hosts.add(worktree.hostId ?? '')
    hostsById.set(worktree.id, hosts)
  }
  return (worktree) => live.has(worktree.id) && (hostsById.get(worktree.id)?.size ?? 1) <= 1
}

function withWindowAgent(risks: WorktreeDeleteRisk[], hasAgent: boolean): WorktreeDeleteRisk[] {
  if (!hasAgent || risks.some((risk) => risk.kind === 'live-agents')) {
    return risks
  }
  return [
    ...risks.filter((risk) => !(risk.kind === 'unknown' && risk.check === 'agents')),
    { kind: 'live-agents', count: 1, agentNames: [] }
  ]
}

/** What deleting each non-main target would lose, read from its own host (local or paired server). */
export async function readTmwkDeleteWorktreeRisks(
  targets: readonly Worktree[],
  signal?: AbortSignal
): Promise<TmwkDeleteWorktreeRiskEntry[]> {
  const deadline = Date.now() + DELETE_RISK_CHECK_TIMEOUT_MS
  const bounded = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(DELETE_RISK_CHECK_TIMEOUT_MS)
  ])
  const hasWindowAgent = liveAgentInWindow()
  const groups = groupByHost(targets.filter((worktree) => !worktree.isMainWorktree))
  const results = await Promise.all(groups.map((group) => readGroupRisks(group, bounded, deadline)))
  return groups.flatMap((group, groupIndex) =>
    group.worktrees.map((worktree, index) => ({
      worktree,
      risks: withWindowAgent(results[groupIndex][index] ?? [], hasWindowAgent(worktree))
    }))
  )
}

/** True only when every target was checked and nothing would be lost. */
export async function isTmwkDeleteRiskFree(targets: readonly Worktree[]): Promise<boolean> {
  try {
    const entries = await readTmwkDeleteWorktreeRisks(targets)
    return entries.every((entry) => entry.risks.length === 0)
  } catch {
    return false
  }
}
