import React, { useMemo } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { withoutHiddenRepos } from '../../../../../shared/project/catalog/hidden-projects'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { useMainChatHost } from '../use-main-chat-host'
import { useNewTicketSheet } from '../new-ticket/new-ticket-sheet-store'
import { openTicketSession } from './open-ticket-session'
import { wrapTicketRowInWorktreeMenu } from './TicketRowWorktreeMenu'
import { TicketWorktreeCard, useTicketCardSessions } from './TicketWorktreeCard'
import { TicketsSidebar } from './TicketsSidebar'
import {
  showInMainView,
  useSidebarCurrent,
  useTicketSidebarStore,
  useTicketsSidebarMode
} from './ticket-sidebar-store'
import { useTicketOverview } from './use-ticket-overview'

/** Rows in the shared project filter (D62), and the filter's label; null label reads "All projects". */
function useProjectFilter(rows: readonly TicketRowModel[]) {
  const t = useTranslate()
  const repos = useAppStore((s) => s.repos)
  const filterRepoIds = useAppStore((s) => s.filterRepoIds)
  return useMemo(() => {
    const selected = withoutHiddenRepos(repos).filter((repo) => filterRepoIds.includes(repo.id))
    if (selected.length === 0) {
      return { rows, label: null }
    }
    const ids = new Set(selected.map((repo) => repo.id))
    return {
      rows: rows.filter((row) => row.projectId !== null && ids.has(row.projectId)),
      label:
        selected.length === 1
          ? selected[0].displayName
          : t('tmwk.tickets.projectCount', '{{count}} projects', {
              count: selected.length,
              defaultValue_one: '{{count}} project'
            })
    }
  }, [rows, repos, filterRepoIds, t])
}

function TicketsSidebarHost(): React.JSX.Element {
  const t = useTranslate()
  const { tabs, targetKey } = useMainChatHost()
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs])
  const overview = useTicketOverview(targetKey, tabIds)
  const filtered = useProjectFilter(overview.rows)
  const cardSessions = useTicketCardSessions(filtered.rows)
  const current = useSidebarCurrent()
  const openTicketId = useTicketSidebarStore((s) => s.openTicketId)
  const setMode = useTicketSidebarStore((s) => s.setMode)
  const openMainPage = useAppStore((s) => s.openMainPage)
  const newTicketSheet = useNewTicketSheet()
  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <TicketsSidebar
        rows={filtered.rows}
        selectedId={current?.kind === 'ticket' ? current.ticketId : null}
        anchorId={openTicketId}
        onSelect={showInMainView}
        onOpenSession={openTicketSession}
        onNewTicket={newTicketSheet.open}
        projectFilterLabel={filtered.label}
        hostUnreachable={
          overview.failed
            ? {
                label: t('tmwk.tickets.homeHost', 'the home host'),
                lastReportAt: overview.lastUpdatedAt
              }
            : null
        }
        onHandOffInChat={openMainPage}
        onOpenWorktreeView={() => setMode('worktrees')}
        renderWorktree={(row) => <TicketWorktreeCard row={row} />}
        cardSessions={cardSessions}
        wrapRow={wrapTicketRowInWorktreeMenu}
      />
    </div>
  )
}

/** Tickets | Worktrees: the sidebar's two modes; Worktrees is Orca's own list, unchanged (D62). */
function SidebarModeSwitch(): React.JSX.Element {
  const t = useTranslate()
  const mode = useTicketSidebarStore((s) => s.mode)
  const setMode = useTicketSidebarStore((s) => s.setMode)
  return (
    <div className="mx-2 mb-1 shrink-0">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (value === 'tickets' || value === 'worktrees') {
            setMode(value)
          }
        }}
        variant="outline"
        size="xs"
        className="w-full justify-stretch"
        aria-label={t('tmwk.tickets.viewMode', 'Sidebar view')}
      >
        <ToggleGroupItem value="tickets" className="grow">
          {t('tmwk.tickets.title', 'Tickets')}
        </ToggleGroupItem>
        <ToggleGroupItem value="worktrees" className="grow">
          {t('tmwk.tickets.worktrees', 'Worktrees')}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

/**
 * Orca's worktree list becomes the Worktree view: the sidebar shows tickets unless it is on (D62).
 * Without a main home there are no tickets, so the list stays as Orca draws it.
 */
export function withTicketsSidebar<P extends object>(
  WorktreeList: React.ComponentType<P>
): React.ComponentType<P> {
  function TicketsOrWorktreeList(props: P): React.JSX.Element {
    const { available, active } = useTicketsSidebarMode()
    return (
      <>
        {available && <SidebarModeSwitch />}
        {active ? <TicketsSidebarHost /> : <WorktreeList {...props} />}
      </>
    )
  }
  return TicketsOrWorktreeList
}
