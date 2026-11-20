import React, { useCallback, useId, useMemo, useRef, useState } from 'react'
import { ListFilter, Plus, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { attentionSections } from '../../../../../shared/tmwk/ticket-overview/ticket-attention'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { titleCollisions } from '../../../../../shared/tmwk/ticket-overview/ticket-title-collisions'
import { AttentionRow } from './AttentionRow'
import { DoneRow } from './DoneRow'
import { QuietRow } from './QuietRow'
import { SessionRows } from './SessionRows'
import { TicketsEmpty } from './TicketsEmpty'
import { DONE_ITEM_KEY, flattenTicketItems, ticketItemKey } from './ticket-list-items'
import { TicketSectionLabel, useReportTime, type TicketRowProps } from './ticket-row-parts'
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
  onProjectFilterClick: () => void
  /** The home host does not answer: the list is its last overview. */
  hostUnreachable?: { label: string; lastReportAt: string | null } | null
  onHandOffInChat: () => void
}

function TicketsHeader({
  projectFilterLabel,
  onProjectFilterClick,
  onNewTicket
}: Pick<
  TicketsSidebarProps,
  'projectFilterLabel' | 'onProjectFilterClick' | 'onNewTicket'
>): React.JSX.Element {
  const t = useTranslate()
  const newTicket = t('tmwk.tickets.newTicket', 'New ticket')
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
      {t('tmwk.tickets.title', 'Tickets')}
      <span className="flex-1" />
      <button
        type="button"
        onClick={onProjectFilterClick}
        aria-label={t('tmwk.tickets.projectFilter', 'Project filter')}
        className="flex h-6 min-w-0 items-center gap-1 rounded-md px-1 text-2xs text-muted-foreground outline-none hover:bg-worktree-sidebar-accent hover:text-worktree-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
      >
        <ListFilter className="size-3 shrink-0" />
        <span className="truncate">
          {projectFilterLabel ?? t('tmwk.tickets.allProjects', 'All projects')}
        </span>
      </button>
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

/** The Attention list: Needs you, Quiet and Done, with sessions one disclosure beneath each ticket. */
export function TicketsSidebar({
  rows,
  selectedId,
  onSelect,
  onOpenSession,
  onNewTicket,
  projectFilterLabel,
  onProjectFilterClick,
  hostUnreachable,
  onHandOffInChat
}: TicketsSidebarProps): React.JSX.Element {
  const t = useTranslate()
  const labelId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [doneOpen, setDoneOpen] = useState(false)
  const sections = useMemo(() => attentionSections(rows), [rows])
  const collisions = useMemo(() => titleCollisions(rows), [rows])
  const items = useMemo(
    () => flattenTicketItems(sections, openIds, doneOpen),
    [sections, openIds, doneOpen]
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
  const toggleDone = useCallback(() => setDoneOpen((open) => !open), [])
  const { activeKey, setActiveKey, onKeyDown } = useTicketListKeyboard({
    listRef: scrollRef,
    items,
    selectedId,
    openIds,
    setTicketOpen,
    doneOpen,
    toggleDone,
    onSelect,
    onOpenSession
  })
  const order = useMemo(
    () => [...sections.needsYou, ...sections.quiet, ...sections.done].map((row) => row.id).join(),
    [sections]
  )
  useSelectedRowAnchor(scrollRef, selectedId === null ? null : ticketItemKey(selectedId), order)

  const renderRow = (row: TicketRowModel, Row: React.ComponentType<TicketRowProps>) => (
    <React.Fragment key={row.id}>
      <Row
        row={row}
        collides={collisions.has(row.id)}
        selected={row.id === selectedId}
        open={openIds.has(row.id)}
        focusable={activeKey === ticketItemKey(row.id)}
        onSelect={onSelect}
        onToggleOpen={toggleTicketOpen}
        onFocusItem={setActiveKey}
      />
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TicketsHeader
        projectFilterLabel={projectFilterLabel}
        onProjectFilterClick={onProjectFilterClick}
        onNewTicket={onNewTicket}
      />
      {hostUnreachable && <HomeHostUnreachable {...hostUnreachable} />}
      {rows.length === 0 ? (
        <TicketsEmpty onHandOffInChat={onHandOffInChat} />
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          aria-label={t('tmwk.tickets.title', 'Tickets')}
          onKeyDown={onKeyDown}
          className="worktree-sidebar-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-2"
        >
          <div role="group" aria-labelledby={`${labelId}-needs`}>
            {sections.needsYou.length > 0 ? (
              <TicketSectionLabel
                id={`${labelId}-needs`}
                label={t('tmwk.tickets.needsYou', 'Needs you')}
                count={sections.needsYou.length}
              />
            ) : (
              <TicketSectionLabel
                id={`${labelId}-needs`}
                label={t('tmwk.tickets.nothingNeedsYou', 'Nothing needs you')}
              />
            )}
            {sections.needsYou.map((row) => renderRow(row, AttentionRow))}
          </div>
          {sections.quiet.length > 0 && (
            <div role="group" aria-labelledby={`${labelId}-quiet`}>
              <TicketSectionLabel
                id={`${labelId}-quiet`}
                label={t('tmwk.tickets.quiet', 'Quiet')}
                count={sections.quiet.length}
              />
              {sections.quiet.map((row) => renderRow(row, QuietRow))}
            </div>
          )}
          {sections.done.length > 0 && (
            <>
              <DoneRow
                count={sections.done.length}
                open={doneOpen}
                focusable={activeKey === DONE_ITEM_KEY}
                onToggle={toggleDone}
                onFocusItem={setActiveKey}
              />
              {doneOpen && sections.done.map((row) => renderRow(row, QuietRow))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
