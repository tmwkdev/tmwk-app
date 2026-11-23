import { useMemo } from 'react'
import type { Translate } from '@/i18n/use-translate'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { useSidebarHostScopeOptions } from '../../worktree-list/controls/use-sidebar-host-scope-options'
import { translateHostDisplayLabel } from '../../../../runtime/hosts/display/execution-host-label'

export function useDeleteWorktreeHostLabels(t: Translate): ReadonlyMap<ExecutionHostId, string> {
  const { hostOptions } = useSidebarHostScopeOptions()
  return useMemo(
    () => new Map(hostOptions.map((host) => [host.id, translateHostDisplayLabel(host, t)])),
    [hostOptions, t]
  )
}
