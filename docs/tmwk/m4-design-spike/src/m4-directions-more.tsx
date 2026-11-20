import React from 'react'
import { Folder, Inbox, MessageCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/class-names'
import type { Ticket, TicketState } from './m4-data'
import { STATE_LABEL, needsMe, sortByAttention } from './m4-data'
import { Agent, HostMark, Row, SectionLabel, SessionRow, SidebarFrame, StateGlyph } from './m4-kit'
import {
  ChatThreads,
  DenseLanes,
  EMPTY_COPY,
  Empty,
  NeedsYouInbox,
  TicketTree,
  groups
} from './m4-directions'

type Props = { tickets: Ticket[]; selected?: string; height?: number }

// E · Projects → tickets → sessions ------------------------------------------

export function ProjectTickets({ tickets, selected, height }: Props): React.JSX.Element {
  const projects = [...new Set(tickets.map((ticket) => ticket.project))]
  return (
    <SidebarFrame height={height}>
      <SectionLabel trailing={<Plus className="size-4 text-muted-foreground" />}>
        Projects
      </SectionLabel>
      {tickets.length === 0 && <Empty>{EMPTY_COPY}</Empty>}
      {projects.map((project) => {
        const items = sortByAttention(tickets.filter((ticket) => ticket.project === project))
        const waiting = items.filter(needsMe).length
        return (
          <div key={project} className="flex flex-col pb-1">
            <div className="flex h-8 items-center gap-2 px-2 text-[13px] font-semibold">
              <Folder className="size-3.5" />
              <span className="flex-1">{project}</span>
              {waiting > 0 && (
                <span className="rounded-full bg-worktree-sidebar-accent px-1.5 text-2xs font-medium tabular-nums">
                  {waiting}
                </span>
              )}
            </div>
            {items.map((ticket) => {
              const active = ticket.id === selected
              return (
                <React.Fragment key={ticket.id}>
                  <Row
                    active={active}
                    className={cn(
                      'flex h-7 items-center gap-2 pl-5 pr-2',
                      ticket.state === 'done' && 'text-muted-foreground'
                    )}
                  >
                    <StateGlyph state={ticket.state} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{ticket.title}</span>
                    <HostMark host={ticket.host} />
                  </Row>
                  {active &&
                    ticket.sessions.map((session) => (
                      <SessionRow key={session.role} session={session} indent={40} />
                    ))}
                </React.Fragment>
              )
            })}
          </div>
        )
      })}
    </SidebarFrame>
  )
}

// F · Since you looked --------------------------------------------------------

export function SinceYouLooked({ tickets, selected, height }: Props): React.JSX.Element {
  const counts = {
    need: tickets.filter(needsMe).length,
    running: tickets.filter((ticket) => ticket.state === 'running').length,
    ongoing: tickets.filter((ticket) => ticket.state === 'ongoing').length
  }
  const changed = sortByAttention(tickets.filter((ticket) => ticket.changed))
  const rest = sortByAttention(tickets.filter((ticket) => !ticket.changed))
  return (
    <SidebarFrame height={height}>
      <div className="my-2 grid grid-cols-3 overflow-hidden rounded-md border border-worktree-sidebar-border">
        {(
          [
            ['Need you', counts.need],
            ['Running', counts.running],
            ['Ongoing', counts.ongoing]
          ] as const
        ).map(([label, value], index) => (
          <div
            key={label}
            className={cn('px-2 py-2', index > 0 && 'border-l border-worktree-sidebar-border')}
          >
            <div className="text-base font-semibold tabular-nums">{value}</div>
            <div className="text-2xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {tickets.length === 0 && <Empty>{EMPTY_COPY}</Empty>}
      {changed.length > 0 && (
        <SectionLabel count={changed.length}>Changed since you looked</SectionLabel>
      )}
      {changed.map((ticket) => (
        <Row key={ticket.id} active={ticket.id === selected} className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <StateGlyph state={ticket.state} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{ticket.title}</span>
            <span className="text-2xs tabular-nums text-muted-foreground">{ticket.age}</span>
          </div>
          <div className="truncate pl-5 text-xs text-muted-foreground">{ticket.line}</div>
        </Row>
      ))}
      {rest.length > 0 && <SectionLabel count={rest.length}>Everything else</SectionLabel>}
      {rest.map((ticket) => (
        <Row
          key={ticket.id}
          active={ticket.id === selected}
          className="flex h-7 items-center gap-2 px-2"
        >
          <StateGlyph state={ticket.state} />
          <span className="min-w-0 flex-1 truncate text-[13px] text-worktree-sidebar-foreground/85">
            {ticket.title}
          </span>
          <span className="text-2xs tabular-nums text-muted-foreground">{ticket.age}</span>
        </Row>
      ))}
    </SidebarFrame>
  )
}

// G · Ticket rail + panel ------------------------------------------------------

export function RailPanel({ tickets, selected, height = 760 }: Props): React.JSX.Element {
  const ordered = sortByAttention(tickets)
  const ticket = ordered.find((item) => item.id === selected) ?? ordered[0]
  return (
    <div
      className="flex overflow-hidden border border-worktree-sidebar-border bg-worktree-sidebar text-worktree-sidebar-foreground"
      style={{ width: 320, height }}
    >
      <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-worktree-sidebar-border pt-12">
        <div className="flex size-9 items-center justify-center rounded-md text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent">
          <MessageCircle className="size-4" />
        </div>
        <div className="my-1 h-px w-6 bg-worktree-sidebar-border" />
        {ordered
          .filter((item) => item.state !== 'done')
          .map((item) => (
            <div
              key={item.id}
              className={cn(
                'relative flex size-9 items-center justify-center rounded-md text-xs font-semibold',
                item.id === ticket?.id
                  ? 'bg-worktree-sidebar-accent'
                  : 'text-worktree-sidebar-foreground/80'
              )}
            >
              {item.title
                .split(' ')
                .slice(0, 2)
                .map((word) => word[0])
                .join('')}
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-worktree-sidebar p-px">
                <StateGlyph state={item.state} />
              </span>
            </div>
          ))}
        <div className="flex-1" />
        <Plus className="mb-3 size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-10 shrink-0 border-b border-worktree-sidebar-border" />
        {ticket ? (
          <div className="flex flex-col gap-3 p-3">
            <div>
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <StateGlyph state={ticket.state} />
                {STATE_LABEL[ticket.state]} · {ticket.project}
              </div>
              <div className="mt-1 text-sm font-semibold leading-5">{ticket.title}</div>
              <div className="mt-1 text-xs leading-4 text-muted-foreground">{ticket.line}</div>
            </div>
            <div>
              <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sessions
              </div>
              {ticket.sessions.map((session) => (
                <SessionRow key={session.role} session={session} indent={0} showModel={false} />
              ))}
            </div>
            <div>
              <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Where
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HostMark host={ticket.host} label />
                <span>· chosen: always-on, has checkout</span>
              </div>
            </div>
          </div>
        ) : (
          <Empty>{EMPTY_COPY}</Empty>
        )}
      </div>
    </div>
  )
}

// H · Tickets as a page, not the sidebar -------------------------------------

export function TicketsPageSidebar({ tickets, height }: Props): React.JSX.Element {
  const waiting = tickets.filter(needsMe).length
  return (
    <SidebarFrame height={height}>
      <Row active className="mt-2 flex h-9 items-center gap-2 px-2 text-sm font-medium">
        <Inbox className="size-4" />
        <span className="flex-1">Tickets</span>
        {waiting > 0 && (
          <span className="rounded-full bg-background px-1.5 text-2xs font-medium tabular-nums">
            {waiting}
          </span>
        )}
      </Row>
      <SectionLabel>Projects</SectionLabel>
      {['tmwk-app', 'website', 'demo'].map((project) => (
        <div key={project} className="flex h-8 items-center gap-2 px-2 text-[13px]">
          <Folder className="size-3.5" />
          {project}
        </div>
      ))}
    </SidebarFrame>
  )
}

export function TicketsPageMain({ tickets }: Props): React.JSX.Element {
  const columns: { label: string; states: TicketState[] }[] = groups
  return (
    <div className="flex h-[760px] min-w-0 flex-1 flex-col bg-background text-foreground">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4 text-sm font-medium">
        Tickets
      </div>
      <div className="grid flex-1 grid-cols-4 gap-3 p-4">
        {columns.map((column) => {
          const items = tickets.filter((ticket) => column.states.includes(ticket.state))
          return (
            <div key={column.label} className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {column.label}
                <span className="tabular-nums">{items.length}</span>
              </div>
              {items.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <StateGlyph state={ticket.state} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {ticket.title}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {ticket.line}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground">
                    {ticket.sessions.map((session) => (
                      <Agent key={session.role} agent={session.agent} size={12} />
                    ))}
                    <span className="flex-1" />
                    <HostMark host={ticket.host} label />
                    <span>{ticket.age}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const DIRECTIONS = [
  ['a', 'A · Ticket tree', 'Tickets grouped by state, sessions always nested beneath.', TicketTree],
  [
    'b',
    'B · Needs-you inbox',
    'Only what needs you gets room; quiet work is one line each.',
    NeedsYouInbox
  ],
  [
    'c',
    'C · Chat-rooted threads',
    'Tickets hang off Chat like threads off one conversation.',
    ChatThreads
  ],
  [
    'd',
    'D · Dense lanes',
    'One-line rows with status slots; sessions only on the open ticket.',
    DenseLanes
  ],
  [
    'e',
    'E · Projects first',
    "Today's Projects tree, with tickets where worktrees were.",
    ProjectTickets
  ],
  [
    'f',
    'F · Since you looked',
    'A count strip, then what changed, then everything else.',
    SinceYouLooked
  ],
  ['g', 'G · Rail and panel', 'A rail of tickets; the selected ticket fills the panel.', RailPanel]
] as const
