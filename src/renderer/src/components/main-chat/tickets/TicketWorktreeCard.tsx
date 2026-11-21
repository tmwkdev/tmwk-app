import React from 'react'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { ticketSessionHost } from './open-ticket-session'
import { useIsSidebarCurrentWorktree } from './ticket-sidebar-store'

const SETTLED = new Set<TicketRowModel['state']>(['done', 'result'])

/**
 * Orca's own worktree card for a working ticket's owner worktree, so its live status, sessions,
 * PR and right-click menu come as Orca draws them. Nothing when the worktree isn't known here.
 */
export function TicketWorktreeCard({ row }: { row: TicketRowModel }): React.JSX.Element | null {
  const owner =
    row.sessions.find((session) => session.role === 'Owner' && session.worktreeId) ??
    row.sessions.find((session) => session.worktreeId)
  const host = owner ? ticketSessionHost(owner) : undefined
  const worktree = useAppStore((s) =>
    owner?.worktreeId && !SETTLED.has(row.state)
      ? s.getKnownWorktreeById(owner.worktreeId, host)
      : undefined
  )
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
