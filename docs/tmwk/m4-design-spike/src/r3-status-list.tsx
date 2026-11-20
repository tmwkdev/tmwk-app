import React from 'react'
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
  Plus,
  Repeat,
  SlidersHorizontal
} from 'lucide-react'
import { cn } from '@/lib/class-names'
import type { Host, Ticket, TicketState } from './m4-data'
import { HOST_LABEL, needsMe, sortByAttention } from './m4-data'
import { Agent, HostMark, Row, SidebarFrame, StateGlyph } from './m4-kit'

export type RowField = 'reason' | 'project' | 'host' | 'agent' | 'age' | 'pr'
export type Density = 'one' | 'two'

export const STATUS_NAME: Record<TicketState, string> = {
  decision: 'Needs decision',
  stop: 'Blocked',
  result: 'Ready for review',
  running: 'Running',
  ongoing: 'Waiting',
  paused: 'Paused',
  done: 'Done'
}

export const DEFAULT_STATUS_ORDER: TicketState[] = [
  'decision',
  'stop',
  'result',
  'running',
  'ongoing',
  'paused',
  'done'
]
export const CUSTOM_STATUS_ORDER: TicketState[] = [
  'done',
  'stop',
  'decision',
  'result',
  'running',
  'ongoing',
  'paused'
]

export function TicketsHeader({
  filter = 'All projects',
  plus,
  options
}: {
  filter?: string
  plus?: boolean
  options?: boolean
}) {
  const icon = (active?: boolean) =>
    cn(
      'flex size-6 items-center justify-center rounded-md text-muted-foreground',
      active && 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
    )
  return (
    <div className="relative flex h-8 shrink-0 items-center gap-0.5 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
      Tickets
      <span className="flex-1" />
      <span className="mr-1 flex items-center gap-1 rounded px-1 text-2xs text-muted-foreground">
        <ListFilter className="size-3" />
        {filter}
      </span>
      <span className={icon(options)}>
        <SlidersHorizontal className="size-3.5" />
      </span>
      <span className={icon(plus)}>
        <Plus className="size-4" />
      </span>
      {plus && (
        <span className="absolute top-8 right-0 z-10 rounded-md bg-foreground px-2 py-1 text-2xs font-medium text-background">
          New ticket
        </span>
      )}
    </div>
  )
}

/** Guardrail: whatever the grouping, the Needs you count stays first. */
export function NeedsYouPin({ tickets }: { tickets: Ticket[] }) {
  const attention = tickets.filter(needsMe)
  const count = (state: TicketState) => attention.filter((t) => t.state === state).length
  if (attention.length === 0) {
    return (
      <div className="mx-0.5 mb-1 flex h-8 shrink-0 items-center px-2 text-xs text-muted-foreground">
        Nothing needs you
      </div>
    )
  }
  return (
    <div className="mx-0.5 mb-1 flex h-8 shrink-0 items-center gap-2 rounded-md border border-worktree-sidebar-border px-2 text-xs">
      <span className="font-medium">Needs you</span>
      <span className="tabular-nums text-muted-foreground">{attention.length}</span>
      <span className="flex-1" />
      {(['decision', 'stop', 'result'] as const).map(
        (state) =>
          count(state) > 0 && (
            <span key={state} className="flex items-center gap-1 tabular-nums">
              <StateGlyph state={state} />
              {count(state)}
            </span>
          )
      )}
      <ChevronDown className="size-3 text-muted-foreground" />
    </div>
  )
}

function Meta({ ticket, show }: { ticket: Ticket; show: RowField[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
      {show.includes('project') && <span>{ticket.project}</span>}
      {show.includes('host') && <HostMark host={ticket.host} />}
      {show.includes('agent') && ticket.sessions[0] && (
        <Agent agent={ticket.sessions[0].agent} size={11} />
      )}
      {show.includes('pr') && ticket.pr && <span>{ticket.pr}</span>}
      {show.includes('age') && <span className="w-5 text-right tabular-nums">{ticket.age}</span>}
    </span>
  )
}

export function OptionRow({
  ticket,
  density,
  show
}: {
  ticket: Ticket
  density: Density
  show: RowField[]
}) {
  const attention = needsMe(ticket)
  const second = attention ? ticket.line : ticket.state === 'paused' ? ticket.line : ticket.handled
  // Needs-you rows keep their reason at every density; the setting only shapes quiet rows.
  const twoLines = attention || (density === 'two' && show.includes('reason') && Boolean(second))
  const done = ticket.state === 'done'
  return (
    <Row className={cn('shrink-0 pl-2 pr-2', twoLines ? 'py-1.5' : 'flex h-7 items-center')}>
      <div className="flex w-full items-center gap-2">
        <StateGlyph state={ticket.state} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px]',
            attention && 'font-medium',
            done && 'text-muted-foreground'
          )}
        >
          {ticket.title}
        </span>
        {ticket.ongoing && <Repeat className="size-3 shrink-0 text-muted-foreground" />}
        <Meta ticket={ticket} show={show} />
      </div>
      {twoLines && (
        <div
          className={cn(
            'pl-5 text-xs',
            attention
              ? 'line-clamp-2 text-worktree-sidebar-foreground/70'
              : 'truncate text-muted-foreground'
          )}
        >
          {second}
        </div>
      )}
    </Row>
  )
}

export function GroupHeading({
  children,
  count,
  collapsed
}: {
  children: React.ReactNode
  count: number
  collapsed?: boolean
}) {
  const Icon = collapsed ? ChevronRight : ChevronDown
  return (
    <div className="flex h-7 shrink-0 items-center gap-1 px-2 pt-1 text-xs font-medium text-worktree-sidebar-foreground/60">
      <Icon className="size-3" />
      {children}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

export type Grouping =
  | { kind: 'status'; order: TicketState[] }
  | { kind: 'project' }
  | { kind: 'host' }

function groupsFor(tickets: Ticket[], grouping: Grouping): [string, Ticket[]][] {
  if (grouping.kind === 'status') {
    return grouping.order.map((state) => [
      STATUS_NAME[state],
      tickets.filter((t) => t.state === state)
    ])
  }
  if (grouping.kind === 'project') {
    const projects = [...new Set(tickets.map((t) => t.project))]
    return projects.map((project) => [
      project,
      sortByAttention(tickets.filter((t) => t.project === project))
    ])
  }
  const hosts: Host[] = ['mbp', 'laptop', 'ona']
  return hosts.map((host) => [
    HOST_LABEL[host],
    sortByAttention(tickets.filter((t) => t.host === host))
  ])
}

const REASON_ONLY: RowField[] = ['reason']
const NONE: string[] = []

export function GroupedList({
  tickets,
  grouping,
  density = 'two',
  show = REASON_ONLY,
  collapsed = NONE
}: {
  tickets: Ticket[]
  grouping: Grouping
  density?: Density
  show?: RowField[]
  collapsed?: string[]
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <NeedsYouPin tickets={tickets} />
      {groupsFor(tickets, grouping)
        .filter(([, rows]) => rows.length > 0)
        .map(([name, rows]) => (
          <React.Fragment key={name}>
            <GroupHeading count={rows.length} collapsed={collapsed.includes(name)}>
              {name}
            </GroupHeading>
            {!collapsed.includes(name) &&
              rows.map((ticket) => (
                <OptionRow key={ticket.id} ticket={ticket} density={density} show={show} />
              ))}
          </React.Fragment>
        ))}
    </div>
  )
}

export function GroupedSidebar(
  props: React.ComponentProps<typeof GroupedList> & { height?: number; filter?: string }
) {
  return (
    <SidebarFrame height={props.height}>
      <TicketsHeader filter={props.filter} />
      <GroupedList {...props} />
    </SidebarFrame>
  )
}
