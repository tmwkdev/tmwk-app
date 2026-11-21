import React from 'react'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import WorktreeContextMenu from '@/components/sidebar/workspace-actions/context-menu/WorktreeContextMenu'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { Worktree } from '../../../../../shared/worktree/types'
import { ticketSessionHost } from './open-ticket-session'
import { useIsSidebarCurrentWorktree } from './ticket-sidebar-store'

const SETTLED = new Set<TicketRowModel['state']>(['done', 'result'])

/** The ticket owner's worktree when this window knows it; `includeSettled` keeps done/result tickets. */
function useTicketOwnerWorktree(
  row: TicketRowModel,
  includeSettled: boolean
): Worktree | undefined {
  const owner =
    row.sessions.find((session) => session.role === 'Owner' && session.worktreeId) ??
    row.sessions.find((session) => session.worktreeId)
  const host = owner ? ticketSessionHost(owner) : undefined
  return useAppStore((s) =>
    owner?.worktreeId && (includeSettled || !SETTLED.has(row.state))
      ? s.getKnownWorktreeById(owner.worktreeId, host)
      : undefined
  )
}

/**
 * Orca's own worktree card for a working ticket's owner worktree, so its live status, sessions,
 * PR and right-click menu come as Orca draws them. Nothing when the worktree isn't known here.
 */
export function TicketWorktreeCard({ row }: { row: TicketRowModel }): React.JSX.Element | null {
  const worktree = useTicketOwnerWorktree(row, false)
  const isActive = useIsSidebarCurrentWorktree(worktree?.id)
  const repo = useRepoById(worktree?.repoId ?? null)
  if (!worktree) {
    return null
  }
  return (
    <div className="pb-1 pl-5">
      <WorktreeCard
        worktree={worktree}
        repo={repo ?? undefined}
        isActive={isActive}
        nativeDragEnabled={false}
      />
    </div>
  )
}

/** Right-click on a ticket row opens Orca's menu for its owner worktree, settled tickets included. */
export function TicketRowWorktreeMenu({
  row,
  children
}: {
  row: TicketRowModel
  children: React.ReactNode
}): React.JSX.Element {
  const worktree = useTicketOwnerWorktree(row, true)
  return worktree ? (
    <WorktreeContextMenu worktree={worktree}>{children}</WorktreeContextMenu>
  ) : (
    <>{children}</>
  )
}
