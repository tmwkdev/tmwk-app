import React from 'react'
import { ChevronDown, ChevronRight, Repeat } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { uiDateTimeFormat } from '@/i18n/ui-intl-formatters'
import type {
  TicketRowHost,
  TicketRowModel
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { statusOf } from '../../../../../shared/tmwk/ticket-overview/ticket-status'
import { useTicketStatusLabels } from './ticket-status-labels'
import { ticketItemKey } from './ticket-list-items'

export type TicketRowProps = {
  row: TicketRowModel
  /** Another row shares the title, so the project is appended. */
  collides: boolean
  selected: boolean
  open: boolean
  /** The roving tab stop of the list. */
  focusable: boolean
  onSelect: (id: string) => void
  onToggleOpen: (id: string) => void
  onFocusItem: (key: string) => void
}

const REPORT_TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
}

export function useReportTime(): (iso: string | null) => string | null {
  const locale = useIntlLocale()
  return React.useCallback(
    (iso: string | null) => {
      const time = iso === null ? Number.NaN : Date.parse(iso)
      return Number.isNaN(time) ? null : uiDateTimeFormat(REPORT_TIME, locale).format(time)
    },
    [locale]
  )
}

/** "<Host> unreachable · last report HH:MM", or null while the host answers. */
export function useUnreachableHostText(host: TicketRowHost | null): string | null {
  const t = useTranslate()
  const reportTime = useReportTime()
  if (!host || host.reachable) {
    return null
  }
  const time = reportTime(host.lastReportAt)
  return time === null
    ? t('tmwk.tickets.hostUnreachable', '{{host}} unreachable', { host: host.label })
    : t('tmwk.tickets.hostUnreachableSince', '{{host}} unreachable · last report {{time}}', {
        host: host.label,
        time
      })
}

export function TicketRowFrame({
  row,
  selected,
  focusable,
  onSelect,
  onFocusItem,
  className,
  children
}: TicketRowProps & { className?: string; children: React.ReactNode }): React.JSX.Element {
  const key = ticketItemKey(row.id)
  return (
    <div
      role="option"
      data-ticket-item={key}
      aria-selected={selected}
      data-current={selected ? 'true' : undefined}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(row.id)}
      onFocus={() => onFocusItem(key)}
      className={cn(
        'group/ticket cursor-default rounded-md pl-2 pr-1 text-worktree-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring',
        selected
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'hover:bg-worktree-sidebar-accent/60',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TicketTitle({
  row,
  collides,
  className
}: {
  row: TicketRowModel
  collides: boolean
  className?: string
}): React.JSX.Element {
  const statusLabels = useTicketStatusLabels()
  return (
    <span className={cn('min-w-0 flex-1 truncate', className)}>
      <span className="sr-only">{statusLabels[statusOf(row)]}: </span>
      {row.title}
      {collides && row.projectName && (
        <span className="font-normal text-muted-foreground"> · {row.projectName}</span>
      )}
    </span>
  )
}

export function OngoingMark({ row }: { row: TicketRowModel }): React.JSX.Element | null {
  const t = useTranslate()
  if (row.kind !== 'ongoing') {
    return null
  }
  return (
    <Repeat
      className="size-3 shrink-0 text-muted-foreground"
      role="img"
      aria-label={t('tmwk.tickets.ongoing', 'Ongoing')}
    />
  )
}

/** The sessions chevron: muted until hover, selection or open; selecting a row never expands it. */
export function RowDisclosure({
  row,
  open,
  selected,
  onToggleOpen
}: Pick<TicketRowProps, 'row' | 'open' | 'selected' | 'onToggleOpen'>): React.JSX.Element {
  if (row.sessions.length === 0) {
    return <span className="size-5 shrink-0" />
  }
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <span
      aria-hidden="true"
      data-ticket-disclosure=""
      onClick={(event) => {
        event.stopPropagation()
        onToggleOpen(row.id)
      }}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-worktree-sidebar-accent',
        !open && !selected && 'opacity-40 group-hover/ticket:opacity-100'
      )}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

export function TicketSectionLabel({
  id,
  label,
  count
}: {
  id: string
  label: string
  count?: number
}): React.JSX.Element {
  return (
    <div
      id={id}
      className="flex h-7 items-center gap-1 px-2 pt-1 text-xs font-medium text-worktree-sidebar-foreground/60"
    >
      {label}
      {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
    </div>
  )
}
