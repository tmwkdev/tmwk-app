import { useAppStore } from '@/store'
import { getWorktreeOnHostFromState } from '@/store/workspaces/selection/worktree-on-host-selector'
import { showWorkspaceListChangedToast } from '@/components/sidebar/worktree-list/listing/stale-workspace-list-toast'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { isTmwkDeleteRiskFree } from './read-tmwk-delete-worktree-risks'

const checking = new Set<string>()

/**
 * "Always delete" still stops for unpushed commits and running work: deletes the re-resolved targets
 * only when the check finds nothing, else hands over to the confirming dialog.
 */
export async function runTmwkAlwaysDeleteWhenRiskFree(
  targets: readonly Worktree[],
  { onRiskFree, onRisky }: { onRiskFree: (current: Worktree[]) => void; onRisky: () => void }
): Promise<void> {
  const keys = targets.map(getWorktreeHostIdentity)
  // A second click while the first check runs would delete twice.
  if (keys.some((key) => checking.has(key))) {
    return
  }
  keys.forEach((key) => checking.add(key))
  let riskFree: boolean
  try {
    riskFree = await isTmwkDeleteRiskFree(targets)
  } finally {
    keys.forEach((key) => checking.delete(key))
  }
  const state = useAppStore.getState()
  const current = targets.map((target) =>
    getWorktreeOnHostFromState(state, target.id, target.hostId)
  )
  if (current.some((worktree, i) => !worktree || worktree.instanceId !== targets[i].instanceId)) {
    showWorkspaceListChangedToast()
    return
  }
  if (riskFree) {
    onRiskFree(current.filter((worktree): worktree is Worktree => worktree !== undefined))
  } else {
    onRisky()
  }
}
