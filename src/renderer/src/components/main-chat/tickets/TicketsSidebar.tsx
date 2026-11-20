import React, { useCallback, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Plus, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store/index'
import {
  isNeedsYou,
  needsYouSummary
} from '../../../../../shared/tmwk/ticket-overview/ticket-attention'
import {
  groupTickets,
  type TicketGroup
} from '../../../../../shared/tmwk/ticket-overview/ticket-grouping'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { titleCollisions } from '../../../../../shared/tmwk/ticket-overview/ticket-title-collisions'
import { AttentionRow } from './AttentionRow'
import { NeedsYouStrip } from './NeedsYouStrip'
import { ProjectFilterChip } from './ProjectFilterChip'
import { QuietRow } from './QuietRow'
import { SessionRows } from './SessionRows'
import { TicketGroupHeading } from './TicketGroupHeading'
import { TicketOptionsMenu } from './TicketOptionsMenu'
import { TicketsEmpty } from './TicketsEmpty'
import { TicketsFilteredEmpty } from './TicketsFilteredEmpty'
import {
  flattenTicketItems,
  groupItemKey,
  ticketItemKey,
  type TicketListGroup
} from './ticket-list-items'
import { useTicketOptionsStore, type TicketOptions } from './ticket-options-store'
import {
  TicketSectionLabel,
  useReportTime,
  type TicketRowDisplay,
  type TicketRowProps
} from './ticket-row-parts'
import { useTicketStatusLabels } from './ticket-status-labels'
import { useSelectedRowAnchor } from './use-selected-row-anchor'
import { useTicketListKeyboard } from './use-ticket-list-keyboard'

export type TicketsSidebarProps = {
  rows: readonly TicketRowModel[]
  /** The open ticket; re-sorting never moves the selection. */
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenSession: (session: TicketRowSession, row: TicketRowModel) => void
  onNewTicket: () => void
  /** The project filter's label; null reads "All projects". */
  projectFilterLabel: string | null
  /** The home host does not answer: the list is its last overview. */
  hostUnreachable?: { label: string; lastReportAt: string | null } | null
  onHandOffInChat: () => void
  /** Ticket options to render with; defaults to the saved ones (D66). */
  options?: TicketOptions
  /** "Clear filters" in filtered-empty; defaults to clearing the saved row filters. */
  onClearFilters?: () => void
  /** "All projects" when the project filter leaves no tickets; defaults to clearing `filterRepoIds`. */
  onClearProjectFilter?: () => void
  /** Ends Ticket options; omitted, the menu has no Worktree view item. */
  onOpenWorktreeView?: () => void
  /** Orca's worktree card for a ticket's owner, under its row; absent in fixtures. */
  renderWorktree?: (row: TicketRowModel) => React.ReactNode
}

const ATTENTION_DONE = 'attention:done'

function TicketsHeader({
  projectFilterLabel,
  onNewTicket,
  onOpenWorktreeView
}: Pick<
  TicketsSidebarProps,
  'projectFilterLabel' | 'onNewTicket' | 'onOpenWorktreeView'
>): React.JSX.Element {
  const t = useTranslate()
  const newTicket = t('tmwk.tickets.newTicket', 'New ticket')
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
      {t('tmwk.tickets.title', 'Tickets')}
      <span className="flex-1" />
      <ProjectFilterChip label={projectFilterLabel} />
      <TicketOptionsMenu onOpenWorktreeView={onOpenWorktreeView} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="muted-field-icon"
            size="icon-xs"
            type="button"
            aria-label={newTicket}
            onClick={onNewTicket}
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {newTicket}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function HomeHostUnreachable({
  label,
  lastReportAt
}: {
  label: string
  lastReportAt: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const time = useReportTime()(lastReportAt)
  return (
    <div
      role="status"
      className="flex items-center gap-1.5 px-2 pb-1 text-xs text-muted-foreground"
    >
      <WifiOff className="size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {time === null
          ? t('tmwk.tickets.homeUnreachable', "Can't reach {{host}}", { host: label })
          : t('tmwk.tickets.homeUnreachableSince', "Can't reach {{host}} · last update {{time}}", {
              host: label,
              time
            })}
      </span>
    </div>
  )
}

function useGroupLabel(): (group: TicketGroup) => string {
  const t = useTranslate()
  const statusLabels = useTicketStatusLabels()
  return useCallback(
    (group: TicketGroup) => {
      const key = group.key
      switch (key.by) {
        case 'attention':
          return key.section === 'needsYou'
            ? t('tmwk.tickets.needsYou', 'Needs you')
            : key.section === 'quiet'
              ? t('tmwk.tickets.quiet', 'Quiet')
              : t('tmwk.tickets.done', 'Done')
        case 'status':
          return statusLabels[key.status]
        case 'project':
          return key.projectName ?? key.projectId ?? t('tmwk.tickets.noProject', 'No project')
        case 'host':
          return key.hostLabel ?? key.hostId ?? t('tmwk.tickets.noHost', 'No host')
        case 'none':
          return ''
      }
    },
    [t, statusLabels]
  )
}

/** The ticket list: Attention sections by default, or the grouping Ticket options pick, with sessions one disclosure beneath each ticket. */
export function TicketsSidebar({
  rows,
  selectedId,
  onSelect,
  onOpenSession,
  onNewTicket,
  projectFilterLabel,
  hostUnreachable,
  onHandOffInChat,
  options: optionsProp,
  onClearFilters,
  onClearProjectFilter,
  onOpenWorktreeView,
  renderWorktree
}: TicketsSidebarProps): React.JSX.Element {
  const t = useTranslate()
  const labelId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const savedOptions = useTicketOptionsStore((s) => s.options)
  const clearRowFilters = useTicketOptionsStore((s) => s.clearRowFilters)
  const options = optionsProp ?? savedOptions
  const groupLabel = useGroupLabel()
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set([ATTENTION_DONE])
  )
  const attention = options.groupBy === 'attention'
  const groups = useMemo(() => groupTickets(rows, options), [rows, options])
  const listGroups = useMemo(
    (): TicketListGroup[] =>
      groups.map((group) => ({
        id: group.id,
        rows: group.rows,
        collapsible: attention ? group.id === ATTENTION_DONE : group.key.by !== 'none'
      })),
    [groups, attention]
  )
  const collisions = useMemo(() => titleCollisions(rows), [rows])
  const summary = useMemo(() => needsYouSummary(rows), [rows])
  const items = useMemo(
    () => flattenTicketItems(listGroups, openIds, collapsedIds),
    [listGroups, openIds, collapsedIds]
  )
  const setTicketOpen = useCallback((id: string, open: boolean) => {
    setOpenIds((current) => {
      const next = new Set(current)
      if (open) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])
  const toggleTicketOpen = useCallback(
    (id: string) => setTicketOpen(id, !openIds.has(id)),
    [openIds, setTicketOpen]
  )
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (!next.delete(groupId)) {
        next.add(groupId)
      }
      return next
    })
  }, [])
  const { activeKey, focusedKey, setActiveKey, onKeyDown } = useTicketListKeyboard({
    listRef: scrollRef,
    items,
    selectedId,
    openIds,
    setTicketOpen,
    collapsedIds,
    toggleGroup,
    spaceGroupId: attention ? ATTENTION_DONE : options.groupBy === 'status' ? 'status:done' : null,
    onSelect,
    onOpenSession
  })
  const displayRows = useMemo(() => groups.flatMap((group) => group.rows), [groups])
  const order = useMemo(() => displayRows.map((row) => row.id).join(), [displayRows])
  useSelectedRowAnchor(scrollRef, selectedId === null ? null : ticketItemKey(selectedId), order)

  // The strip moves focus to the next needs-you row in screen order, opening its group first.
  const jumpToNeedsYou = useCallback(() => {
    const needsYou = displayRows.filter(isNeedsYou)
    if (needsYou.length === 0) {
      return
    }
    const current = needsYou.findIndex((row) => ticketItemKey(row.id) === focusedKey)
    const target = needsYou[(current + 1) % needsYou.length]
    const group = groups.find((entry) => entry.rows.includes(target))
    if (group && collapsedIds.has(group.id)) {
      // Commit the opened group now so the row exists to focus.
      flushSync(() => toggleGroup(group.id))
    }
    const key = ticketItemKey(target.id)
    const element = scrollRef.current?.querySelector<HTMLElement>(
      `[data-ticket-item="${CSS.escape(key)}"]`
    )
    if (element) {
      setActiveKey(key)
      element.focus({ preventScroll: true })
      element.scrollIntoView({ block: 'center' })
    }
  }, [displayRows, focusedKey, groups, collapsedIds, toggleGroup, setActiveKey])

  const display: TicketRowDisplay = { density: options.density, showOnRows: options.showOnRows }
  const renderRow = (row: TicketRowModel, Row?: React.ComponentType<TicketRowProps>) => {
    const RowComponent = Row ?? (isNeedsYou(row) ? AttentionRow : QuietRow)
    return (
      <React.Fragment key={row.id}>
        <RowComponent
          row={row}
          collides={collisions.has(row.id)}
          selected={row.id === selectedId}
          open={openIds.has(row.id)}
          focusable={activeKey === ticketItemKey(row.id)}
          onSelect={onSelect}
          onToggleOpen={toggleTicketOpen}
          onFocusItem={setActiveKey}
          display={display}
        />
        {renderWorktree?.(row)}
        {openIds.has(row.id) && row.sessions.length > 0 && (
          <SessionRows
            row={row}
            activeKey={activeKey}
            onOpenSession={onOpenSession}
            onFocusItem={setActiveKey}
          />
        )}
      </React.Fragment>
    )
  }

  const renderGroup = (group: TicketListGroup, source: TicketGroup) => {
    const open = !collapsedIds.has(group.id)
    if (group.collapsible) {
      return (
        <div key={group.id} role="group" aria-label={groupLabel(source)}>
          <TicketGroupHeading
            groupId={group.id}
            label={groupLabel(source)}
            count={group.rows.length}
            open={open}
            focusable={activeKey === groupItemKey(group.id)}
            onToggle={toggleGroup}
            onFocusItem={setActiveKey}
            className={group.id === ATTENTION_DONE ? 'mt-1' : undefined}
          />
          {open && group.rows.map((row) => renderRow(row, attention ? QuietRow : undefined))}
        </div>
      )
    }
    if (source.key.by === 'none') {
      return (
        <React.Fragment key={group.id}>{group.rows.map((row) => renderRow(row))}</React.Fragment>
      )
    }
    const needsYouSection = source.key.by === 'attention' && source.key.section === 'needsYou'
    const headingId = `${labelId}-${group.id}`
    return (
      <div key={group.id} role="group" aria-labelledby={headingId}>
        {needsYouSection && group.rows.length === 0 ? (
          <TicketSectionLabel
            id={headingId}
            label={t('tmwk.tickets.nothingNeedsYou', 'Nothing needs you')}
          />
        ) : (
          <TicketSectionLabel id={headingId} label={groupLabel(source)} count={group.rows.length} />
        )}
        {group.rows.map((row) => renderRow(row, needsYouSection ? AttentionRow : QuietRow))}
      </div>
    )
  }

  const clearFilters = onClearFilters ?? clearRowFilters
  const clearProjectFilter =
    onClearProjectFilter ?? (() => useAppStore.getState().setFilterRepoIds([]))
  const filteredEmpty = rows.length > 0 && displayRows.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TicketsHeader
        projectFilterLabel={projectFilterLabel}
        onNewTicket={onNewTicket}
        onOpenWorktreeView={onOpenWorktreeView}
      />
      {hostUnreachable && <HomeHostUnreachable {...hostUnreachable} />}
      {rows.length === 0 && projectFilterLabel === null ? (
        <TicketsEmpty onHandOffInChat={onHandOffInChat} />
      ) : (
        <div
          ref={scrollRef}
          className={cn(
            'worktree-sidebar-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-2',
            // Keyboard focus scrolls rows clear of the pinned strip.
            !attention && 'scroll-pt-10'
          )}
        >
          {!attention && (
            <NeedsYouStrip
              summary={summary}
              scopeLabel={projectFilterLabel}
              onJump={jumpToNeedsYou}
            />
          )}
          {rows.length === 0 && projectFilterLabel !== null ? (
            <TicketsFilteredEmpty
              message={t('tmwk.tickets.noTicketsInProject', 'No tickets in {{project}}', {
                project: projectFilterLabel
              })}
              action={t('tmwk.tickets.allProjects', 'All projects')}
              onAction={clearProjectFilter}
            />
          ) : filteredEmpty ? (
            <TicketsFilteredEmpty
              message={t('tmwk.tickets.noMatches', 'No tickets match these filters')}
              action={t('tmwk.tickets.clearFilters', 'Clear filters')}
              onAction={clearFilters}
            />
          ) : (
            <div
              role="listbox"
              aria-label={t('tmwk.tickets.title', 'Tickets')}
              onKeyDown={onKeyDown}
              className="flex flex-col"
            >
              {listGroups.map((group, index) => renderGroup(group, groups[index]))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
