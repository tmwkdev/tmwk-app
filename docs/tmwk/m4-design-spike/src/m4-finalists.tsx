import React from 'react'
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ListFilter,
  MessageCircle,
  Plus,
  Repeat,
  Search,
  WifiOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import type { Ticket } from './m4-data'
import { needsMe, sortByAttention } from './m4-data'
import { Agent, Row, SessionGlyph, SidebarFrame, StateGlyph } from './m4-kit'

const DuplicateTitles = React.createContext<Set<string>>(new Set())

function Title({ ticket, className }: { ticket: Ticket; className?: string }) {
  const duplicates = React.useContext(DuplicateTitles)
  return (
    <span className={cn('min-w-0 flex-1 truncate', className)}>
      {ticket.title}
      {duplicates.has(ticket.title) && (
        <span className="font-normal text-muted-foreground"> · {ticket.project}</span>
      )}
    </span>
  )
}

export type ListProps = {
  tickets: Ticket[]
  selected?: string
  expanded?: string
  height?: number
  hover?: string
}

// Shared rows -------------------------------------------------------------------

function Disclosure({ open, visible }: { open: boolean; visible: boolean }) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground',
        !visible && 'opacity-40'
      )}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

function Sessions({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex flex-col pb-1">
      {ticket.sessions.map((session) => (
        <div
          key={session.role}
          className="flex h-7 items-center gap-2 rounded-md pl-7 pr-2 text-[13px] text-worktree-sidebar-foreground/85"
        >
          <SessionGlyph status={session.status} />
          <Agent agent={session.agent} />
          <span className="min-w-0 flex-1 truncate">{session.role}</span>
        </div>
      ))}
    </div>
  )
}

function Marks({ ticket }: { ticket: Ticket }) {
  return (
    <>
      {ticket.offline && <WifiOff className="size-3 shrink-0 text-muted-foreground" />}
      {ticket.ongoing && <Repeat className="size-3 shrink-0 text-muted-foreground" />}
    </>
  )
}

export function AttentionRow({
  ticket,
  active,
  open,
  hover
}: {
  ticket: Ticket
  active: boolean
  open: boolean
  hover: boolean
}) {
  return (
    <>
      <Row
        active={active}
        className={cn('py-1.5 pl-2 pr-1', hover && !active && 'bg-worktree-sidebar-accent/60')}
      >
        <div className="flex items-center gap-2">
          <StateGlyph state={ticket.state} />
          <Title ticket={ticket} className="text-[13px] font-medium" />
          <Marks ticket={ticket} />
          <Disclosure open={open} visible={active || hover || open} />
        </div>
        <div className="line-clamp-2 pl-5 pr-6 text-xs leading-4 text-worktree-sidebar-foreground/70">
          {ticket.line}
          {ticket.offline && <span className="text-muted-foreground"> · last report 10:42</span>}
        </div>
      </Row>
      {open && <Sessions ticket={ticket} />}
    </>
  )
}

export function QuietRow({
  ticket,
  active,
  open,
  hover
}: {
  ticket: Ticket
  active: boolean
  open: boolean
  hover: boolean
}) {
  const second = ticket.state === 'paused' ? ticket.line : ticket.handled
  return (
    <>
      <Row
        active={active}
        className={cn(
          'pl-2 pr-1',
          second ? 'py-1.5' : 'flex h-7 items-center',
          hover && !active && 'bg-worktree-sidebar-accent/60'
        )}
      >
        <div className="flex w-full items-center gap-2">
          <StateGlyph state={ticket.state} />
          <Title
            ticket={ticket}
            className={cn(
              'text-[13px]',
              ticket.state === 'done'
                ? 'text-muted-foreground'
                : 'text-worktree-sidebar-foreground/90'
            )}
          />
          <Marks ticket={ticket} />
          <Disclosure open={open} visible={active || hover || open} />
        </div>
        {second && <div className="truncate pl-5 pr-6 text-xs text-muted-foreground">{second}</div>}
      </Row>
      {open && <Sessions ticket={ticket} />}
    </>
  )
}

function GroupLabel({
  children,
  count,
  collapsed
}: {
  children: React.ReactNode
  count: number
  collapsed?: boolean
}) {
  return (
    <div className="flex h-7 items-center gap-1 px-2 pt-1 text-xs font-medium text-worktree-sidebar-foreground/60">
      {collapsed && <ChevronRight className="size-3" />}
      {children}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

function Empty({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length > 0) {
    return null
  }
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-4 text-[13px] leading-5 text-muted-foreground">
      Work you hand off in Chat shows up here.
      <Button size="xs" variant="outline">
        <MessageCircle className="size-3" />
        Hand off work in Chat
      </Button>
    </div>
  )
}

export function TicketList({ tickets, selected, expanded, hover }: ListProps) {
  const attention = sortByAttention(tickets.filter(needsMe))
  const running = tickets
    .filter((ticket) => ['running', 'paused', 'ongoing'].includes(ticket.state))
    .sort((a, b) => Number(Boolean(a.ongoing)) - Number(Boolean(b.ongoing)))
  const done = tickets.filter((ticket) => ticket.state === 'done')
  const rowProps = (ticket: Ticket) => ({
    ticket,
    active: ticket.id === selected,
    open: ticket.id === expanded,
    hover: ticket.id === hover
  })
  const duplicates = React.useMemo(() => {
    const titles = tickets.map((ticket) => ticket.title)
    return new Set(titles.filter((title, index) => titles.indexOf(title) !== index))
  }, [tickets])
  return (
    <DuplicateTitles.Provider value={duplicates}>
      <div className="flex min-h-0 flex-col overflow-hidden">
        <Empty tickets={tickets} />
        {tickets.length > 0 && (
          <>
            {attention.length > 0 ? (
              <GroupLabel count={attention.length}>Needs you</GroupLabel>
            ) : (
              <div className="flex h-7 items-center px-2 pt-1 text-xs font-medium text-worktree-sidebar-foreground/60">
                Nothing needs you
              </div>
            )}
            {attention.map((ticket) => (
              <AttentionRow key={ticket.id} {...rowProps(ticket)} />
            ))}
          </>
        )}
        {running.length > 0 && (
          <>
            <GroupLabel count={running.length}>Quiet</GroupLabel>
            {running.map((ticket) => (
              <QuietRow key={ticket.id} {...rowProps(ticket)} />
            ))}
          </>
        )}
        {done.length > 0 && (
          <GroupLabel count={done.length} collapsed>
            Done
          </GroupLabel>
        )}
      </div>
    </DuplicateTitles.Provider>
  )
}

function TicketsHeader({ filter }: { filter?: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
      Tickets
      <span className="flex-1" />
      <span className="flex items-center gap-1 rounded px-1 text-2xs text-muted-foreground">
        <ListFilter className="size-3" />
        {filter ?? 'All projects'}
      </span>
      <Plus className="ml-1 size-4 text-muted-foreground" />
    </div>
  )
}

// Finalist 1 · Attention list (B + D) --------------------------------------------

export function AttentionList(props: ListProps) {
  return (
    <SidebarFrame height={props.height}>
      <TicketsHeader />
      <TicketList {...props} />
    </SidebarFrame>
  )
}

// Finalist 2 · Chat on top (revised C) -------------------------------------------

export function ChatOnTop(props: ListProps & { chatActive?: boolean }) {
  return (
    <SidebarFrame height={props.height} dock={false} nav={false}>
      <div className="pt-2" />
      <Row
        active={props.chatActive}
        className="flex h-11 shrink-0 items-center gap-2 px-2 text-sm font-semibold"
      >
        <MessageCircle className="size-4" />
        <span className="flex-1">Chat</span>
      </Row>
      <div className="flex h-9 shrink-0 items-center gap-2 px-2 text-[13px] text-muted-foreground">
        <Search className="size-4" />
        Search
      </div>
      <div className="my-1 h-px shrink-0 bg-worktree-sidebar-border" />
      <TicketsHeader />
      <TicketList {...props} />
      <div className="flex-1" />
      <div className="-mx-2 flex h-9 shrink-0 items-center gap-1.5 border-t border-worktree-sidebar-border px-4 text-xs font-medium text-worktree-sidebar-foreground/70">
        <ChevronRight className="size-3" />
        Projects
        <span className="text-muted-foreground">3</span>
      </div>
    </SidebarFrame>
  )
}

// Finalist 3 · Shelf and queue ---------------------------------------------------

export function Shelf({ tickets, selected, expanded, height }: ListProps) {
  // Stable order: newest first, never re-sorted by state, so resolving attention never moves a row.
  const live = tickets.filter((ticket) => ticket.state !== 'done')
  const done = tickets.filter((ticket) => ticket.state === 'done')
  return (
    <SidebarFrame height={height}>
      <TicketsHeader />
      <Empty tickets={tickets} />
      {live.map((ticket) => (
        <React.Fragment key={ticket.id}>
          <Row
            active={ticket.id === selected}
            className="flex h-7 shrink-0 items-center gap-2 pl-2 pr-1"
          >
            <StateGlyph state={ticket.state} />
            <span className="min-w-0 flex-1 truncate text-[13px]">{ticket.title}</span>
            <Marks ticket={ticket} />
            <Disclosure open={ticket.id === expanded} visible={ticket.id === selected} />
          </Row>
          {ticket.id === expanded && <Sessions ticket={ticket} />}
        </React.Fragment>
      ))}
      {done.length > 0 && (
        <GroupLabel count={done.length} collapsed>
          Done
        </GroupLabel>
      )}
    </SidebarFrame>
  )
}

const queueActions: Record<string, [string, string]> = {
  settings: ['Remove it', 'Keep for one release'],
  release: ['Open ticket', 'Later'],
  flaky: ['Accept', 'Open PR #412'],
  deploys: ['Roll back', 'Keep it'],
  'extra-4': ['Accept', 'Open PR #420'],
  'extra-6': ['PowerShell', 'cmd']
}

export function QueueAndChat({
  tickets,
  showQueue = true
}: {
  tickets: Ticket[]
  showQueue?: boolean
}) {
  const queue = sortByAttention(tickets.filter(needsMe))
  return (
    <div className="flex min-w-0 flex-1 flex-col border-y border-r border-border bg-background text-foreground">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4 text-sm font-medium">
        Chat
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6">
        <div className="flex w-full max-w-[680px] flex-col gap-3 py-5 text-sm leading-6">
          <div className="self-end rounded-2xl bg-muted px-4 py-2">What needs me?</div>
          <div>
            {queue.length === 0
              ? 'Nothing needs you. Four tickets are running quietly.'
              : showQueue
                ? `${queue.length} things, decisions first. They stay above the composer until each is handled.`
                : 'Three things. New settings page asks whether to keep the legacy shortcuts panel; I would remove it. Release notes for 1.5 stopped because the docs deploy token expired. PR #412 for the checks link is ready to review.'}
          </div>
        </div>
        <div className="flex-1" />
        <div className="w-full max-w-[680px]">
          {showQueue && queue.length > 0 && (
            <div className="mb-2 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xs">
              <div className="flex h-8 items-center gap-1.5 border-b border-border px-3 text-xs font-medium text-muted-foreground">
                Needs you
                <span className="tabular-nums">{queue.length}</span>
              </div>
              {queue.slice(0, 4).map((ticket, index) => {
                const [primary, secondary] = queueActions[ticket.id] ?? ['Open ticket', 'Later']
                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2',
                      index > 0 && 'border-t border-border'
                    )}
                  >
                    <StateGlyph state={ticket.state} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{ticket.line}</div>
                      <div className="truncate text-xs text-muted-foreground">{ticket.title}</div>
                    </div>
                    <Button size="xs" variant={index === 0 ? 'default' : 'outline'}>
                      {primary}
                    </Button>
                    <Button size="xs" variant="ghost">
                      {secondary}
                    </Button>
                  </div>
                )
              })}
              {queue.length > 4 && (
                <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                  {queue.length - 4} more
                </div>
              )}
            </div>
          )}
          <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-sm text-muted-foreground">Ask anything, or hand off work</div>
            <div className="mt-3 flex items-center justify-end">
              <span className="flex size-7 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
                <ArrowUp className="size-4" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
