import React, { useCallback, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { withoutHiddenRepos } from '../../../../../shared/project/catalog/hidden-projects'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { useMainChatHost } from '../use-main-chat-host'
import { openTicketSession } from './open-ticket-session'
import { TicketsSidebar } from './TicketsSidebar'
import { useTicketSidebarStore, useTicketsSidebarMode } from './ticket-sidebar-store'
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
  const selectedId = useTicketSidebarStore((s) => s.openTicketId)
  const setOpenTicketId = useTicketSidebarStore((s) => s.setOpenTicketId)
  const setMode = useTicketSidebarStore((s) => s.setMode)
  const openMainPage = useAppStore((s) => s.openMainPage)
  // W6 replaces this with NewTicketSheet.
  const openNewTicket = useCallback(() => {}, [])
  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <TicketsSidebar
        rows={filtered.rows}
        selectedId={selectedId}
        // W4 opens the selected ticket in the main view (D65).
        onSelect={setOpenTicketId}
        onOpenSession={openTicketSession}
        onNewTicket={openNewTicket}
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
      />
    </div>
  )
}

function TicketsLink(): React.JSX.Element {
  const t = useTranslate()
  const setMode = useTicketSidebarStore((s) => s.setMode)
  return (
    <button
      type="button"
      onClick={() => setMode('tickets')}
      className="mx-2 mb-1 flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-worktree-sidebar-foreground/70 outline-none hover:bg-worktree-sidebar-accent hover:text-worktree-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
    >
      <ArrowLeft className="size-3.5 shrink-0" />
      {t('tmwk.tickets.title', 'Tickets')}
    </button>
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
    if (active) {
      return <TicketsSidebarHost />
    }
    return (
      <>
        {available && <TicketsLink />}
        <WorktreeList {...props} />
      </>
    )
  }
  return TicketsOrWorktreeList
}
