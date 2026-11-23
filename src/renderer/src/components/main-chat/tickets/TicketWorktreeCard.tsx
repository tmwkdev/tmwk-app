import React, { useMemo } from 'react'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import { selectDrawsNewWorktreeCards } from '@/store/appearance/worktree-card-style'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { getWorktreeCardDetails } from '../../../../../shared/worktree/row-display/card-properties'
import type { Worktree } from '../../../../../shared/worktree/types'
import { findSessionPane, ticketSessionHost } from './open-ticket-session'
import type { TicketCardSessions } from './ticket-list-items'
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

/** The sessions a shown card lists itself: live panes in its worktree, while cards show inline agents. */
function cardListedSessionIds(
  state: AppState,
  row: TicketRowModel,
  worktreeId: string,
  inlineAgents: boolean
): string[] {
  if (!inlineAgents) {
    return []
  }
  return row.sessions
    .filter(
      (session) =>
        session.terminalHandle !== null &&
        findSessionPane(state, session.terminalHandle)?.worktreeId === worktreeId
    )
    .map((session) => session.id)
}

/** Per ticket whose `TicketWorktreeCard` shows, the sessions that card already lists, so the list leaves them to it. */
export function useTicketCardSessions(rows: readonly TicketRowModel[]): TicketCardSessions {
  // A string keeps the selector's result stable between unrelated store updates.
  const signature = useAppStore((s) => {
    const { inlineAgents } = getWorktreeCardDetails(s.worktreeCardProperties, {
      compactWorktreeCards: s.settings?.compactWorktreeCards === true,
      newCardStyle: selectDrawsNewWorktreeCards(s)
    })
    return rows
      .flatMap((row) => {
        const worktree = knownOwnerWorktree(s, row, ownerSession(row), false)
        return worktree
          ? [[row.id, ...cardListedSessionIds(s, row, worktree.id, inlineAgents)].join('\t')]
          : []
      })
      .join('\n')
  })
  return useMemo(
    () =>
      new Map(
        signature
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [rowId, ...sessionIds] = line.split('\t')
            return [rowId, new Set(sessionIds)]
          })
      ),
    [signature]
  )
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
