import React, { useMemo } from 'react'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { Worktree } from '../../../../../shared/worktree/types'
import { ticketSessionHost } from './open-ticket-session'
import type { TicketCardOwners } from './ticket-list-items'
import { useIsSidebarCurrentWorktree } from './ticket-sidebar-store'

const SETTLED = new Set<TicketRowModel['state']>(['done', 'result'])

type AppState = ReturnType<typeof useAppStore.getState>

function ownerSession(row: TicketRowModel): TicketRowSession | undefined {
  return (
    row.sessions.find((session) => session.role === 'Owner' && session.worktreeId) ??
    row.sessions.find((session) => session.worktreeId)
  )
}

function knownOwnerWorktree(
  state: AppState,
  row: TicketRowModel,
  owner: TicketRowSession | undefined,
  includeSettled: boolean
): Worktree | undefined {
  return owner?.worktreeId && (includeSettled || !SETTLED.has(row.state))
    ? state.getKnownWorktreeById(owner.worktreeId, ticketSessionHost(owner))
    : undefined
}

/** The ticket owner's worktree when this window knows it; `includeSettled` keeps done/result tickets. */
export function useTicketOwnerWorktree(
  row: TicketRowModel,
  { includeSettled }: { includeSettled: boolean }
): Worktree | undefined {
  const owner = ownerSession(row)
  return useAppStore((s) => knownOwnerWorktree(s, row, owner, includeSettled))
}

/** Per ticket, the owner whose worktree `TicketWorktreeCard` draws, so the list leaves that worktree's sessions to the card. */
export function useTicketCardOwners(rows: readonly TicketRowModel[]): TicketCardOwners {
  // A string keeps the selector's result stable between unrelated store updates.
  const carded = useAppStore((s) =>
    rows
      .filter((row) => knownOwnerWorktree(s, row, ownerSession(row), false))
      .map((row) => row.id)
      .join('\n')
  )
  return useMemo(() => {
    const ids = new Set(carded.split('\n'))
    const owners = new Map<string, TicketRowSession>()
    for (const row of rows) {
      const owner = ownerSession(row)
      if (owner && ids.has(row.id)) {
        owners.set(row.id, owner)
      }
    }
    return owners
  }, [rows, carded])
}

/**
 * Orca's own worktree card for a working ticket's owner worktree, so its live status, sessions,
 * PR and right-click menu come as Orca draws them. Nothing when the worktree isn't known here.
 */
export function TicketWorktreeCard({ row }: { row: TicketRowModel }): React.JSX.Element | null {
  const worktree = useTicketOwnerWorktree(row, { includeSettled: false })
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
