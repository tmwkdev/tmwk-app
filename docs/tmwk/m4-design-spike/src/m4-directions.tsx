import React from 'react'
import {
  ChevronDown,
  ChevronRight,
  LayoutList,
  MessageCircle,
  Plus,
  Search,
  SquareStack
} from 'lucide-react'
import type { Ticket, TicketState } from './m4-data'
import { STATE_LABEL, needsMe, sortByAttention } from './m4-data'
import { Agent, HostMark, Row, SectionLabel, SessionRow, SidebarFrame, StateGlyph } from './m4-kit'

type Props = { tickets: Ticket[]; selected?: string; height?: number }

export const groups: { label: string; states: TicketState[] }[] = [
  { label: 'Needs you', states: ['decision', 'stop', 'result'] },
  { label: 'Running', states: ['running', 'paused'] },
  { label: 'Ongoing', states: ['ongoing'] },
  { label: 'Done', states: ['done'] }
]

export function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="px-2 py-6 text-[13px] leading-5 text-muted-foreground">{children}</div>
}

export const EMPTY_COPY = 'No tickets yet. Ask in Chat to start one.'

// A · Ticket tree ------------------------------------------------------------

function TreeTicket({ ticket, active }: { ticket: Ticket; active: boolean }) {
  const showSessions = ticket.state !== 'done'
  return (
    <div className="flex flex-col">
      <Row active={active} className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <StateGlyph state={ticket.state} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{ticket.title}</span>
          {ticket.host !== 'mbp' && <HostMark host={ticket.host} />}
          <span className="text-2xs tabular-nums text-muted-foreground">{ticket.age}</span>
        </div>
        <div className="truncate pl-5 text-xs text-muted-foreground">
          {ticket.project} · {ticket.line}
        </div>
      </Row>
      {showSessions &&
        ticket.sessions.map((session) => (
          <SessionRow key={session.role + session.agent} session={session} indent={20} />
        ))}
    </div>
  )
}

export function TicketTree({ tickets, selected, height }: Props): React.JSX.Element {
  return (
    <SidebarFrame height={height}>
      <SectionLabel trailing={<Plus className="size-4 text-muted-foreground" />}>
        Tickets
      </SectionLabel>
      {tickets.length === 0 && <Empty>{EMPTY_COPY}</Empty>}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {groups.map((group) => {
          const items = tickets.filter((ticket) => group.states.includes(ticket.state))
          if (items.length === 0) {
            return null
          }
          const collapsed = group.label === 'Done'
          return (
            <React.Fragment key={group.label}>
              <div className="flex h-7 items-center gap-1 px-2 pt-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {collapsed ? <ChevronRight className="size-3" /> : null}
                {group.label}
                <span className="tabular-nums">{items.length}</span>
              </div>
              {!collapsed &&
                items.map((ticket) => (
                  <TreeTicket key={ticket.id} ticket={ticket} active={ticket.id === selected} />
                ))}
            </React.Fragment>
          )
        })}
      </div>
    </SidebarFrame>
  )
}

// B · Needs-you inbox --------------------------------------------------------

export function NeedsYouInbox({ tickets, selected, height }: Props): React.JSX.Element {
  const attention = sortByAttention(tickets.filter(needsMe))
  const quiet = tickets.filter((ticket) => !needsMe(ticket) && ticket.state !== 'done')
  const done = tickets.filter((ticket) => ticket.state === 'done')
  return (
    <SidebarFrame height={height}>
      <SectionLabel count={attention.length}>Needs you</SectionLabel>
      {tickets.length === 0 && <Empty>{EMPTY_COPY}</Empty>}
      {tickets.length > 0 && attention.length === 0 && (
        <div className="px-2 pb-2 text-[13px] text-muted-foreground">Nothing needs you.</div>
      )}
      <div className="flex flex-col gap-0.5">
        {attention.map((ticket) => (
          <Row key={ticket.id} active={ticket.id === selected} className="px-2 py-2">
            <div className="flex items-center gap-2">
              <StateGlyph state={ticket.state} />
              <span className="text-2xs font-medium text-muted-foreground">
                {STATE_LABEL[ticket.state]}
              </span>
              <span className="flex-1" />
              <span className="text-2xs tabular-nums text-muted-foreground">{ticket.age}</span>
            </div>
            <div className="mt-0.5 truncate pl-5 text-[13px] font-medium">{ticket.title}</div>
            <div className="truncate pl-5 text-xs text-muted-foreground">{ticket.line}</div>
          </Row>
        ))}
      </div>
      <div className="mt-2 border-t border-worktree-sidebar-border pt-1">
        <SectionLabel count={quiet.length}>Quiet</SectionLabel>
        {quiet.map((ticket) => (
          <Row
            key={ticket.id}
            active={ticket.id === selected}
            className="flex h-7 items-center gap-2 px-2"
          >
            <StateGlyph state={ticket.state} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-worktree-sidebar-foreground/85">
              {ticket.title}
            </span>
            <Agent agent={ticket.sessions[0].agent} size={12} />
          </Row>
        ))}
        {done.length > 0 && (
          <div className="flex h-7 items-center gap-1 px-2 text-xs text-muted-foreground">
            <ChevronRight className="size-3" />
            Done today {done.length}
          </div>
        )}
      </div>
    </SidebarFrame>
  )
}

// C · Chat-rooted threads ----------------------------------------------------

export function ChatThreads({ tickets, selected, height }: Props): React.JSX.Element {
  const live = sortByAttention(tickets.filter((ticket) => ticket.state !== 'done'))
  const done = tickets.filter((ticket) => ticket.state === 'done')
  return (
    <SidebarFrame height={height} dock={false} nav={false}>
      <div className="pt-2" />
      <Row active={!selected} className="flex h-11 items-center gap-2 px-2 text-sm font-semibold">
        <MessageCircle className="size-4" />
        <span className="flex-1">Chat</span>
        <Search className="size-4 text-muted-foreground" />
      </Row>
      <div className="relative ml-[15px] flex flex-col border-l border-worktree-sidebar-border pl-2">
        {tickets.length === 0 && (
          <div className="py-2 pl-1 text-xs text-muted-foreground">
            Tickets you start in Chat appear here.
          </div>
        )}
        {live.map((ticket) => (
          <Row key={ticket.id} active={ticket.id === selected} className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">{ticket.title}</span>
              <StateGlyph state={ticket.state} />
            </div>
            {needsMe(ticket) && (
              <div className="truncate text-xs text-muted-foreground">{ticket.line}</div>
            )}
          </Row>
        ))}
        {done.length > 0 && (
          <div className="flex h-7 items-center gap-1 px-2 text-xs text-muted-foreground">
            <ChevronRight className="size-3" />
            {done.length} done
          </div>
        )}
      </div>
      <div className="flex-1" />
      <div className="border-t border-worktree-sidebar-border py-1">
        <div className="flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
          <ChevronRight className="size-3" />
          Projects
          <span className="text-muted-foreground">3</span>
        </div>
      </div>
    </SidebarFrame>
  )
}

// D · Dense lanes with status slots -----------------------------------------

export function DenseLanes({ tickets, selected, height }: Props): React.JSX.Element {
  return (
    <SidebarFrame height={height}>
      <div className="flex h-8 items-center gap-1 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
        Tickets
        <span className="flex-1" />
        <LayoutList className="size-3.5 text-muted-foreground" />
        <Plus className="ml-2 size-4 text-muted-foreground" />
      </div>
      {tickets.length === 0 && <Empty>{EMPTY_COPY}</Empty>}
      {groups.map((group) => {
        const items = tickets.filter((ticket) => group.states.includes(ticket.state))
        if (items.length === 0) {
          return null
        }
        return (
          <div key={group.label} className="flex flex-col">
            <div className="flex h-6 items-center gap-1 px-2 text-2xs text-muted-foreground">
              <ChevronDown className="size-3" />
              {group.label}
              <span className="tabular-nums">{items.length}</span>
            </div>
            {items.map((ticket) => {
              const active = ticket.id === selected
              return (
                <React.Fragment key={ticket.id}>
                  <Row active={active} className="flex h-7 items-center gap-2 px-2">
                    <StateGlyph state={ticket.state} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{ticket.title}</span>
                    {ticket.sessions.length > 1 && (
                      <span className="flex items-center gap-0.5 text-2xs tabular-nums text-muted-foreground">
                        <SquareStack className="size-3" />
                        {ticket.sessions.length}
                      </span>
                    )}
                    {ticket.changed && <span className="size-1.5 rounded-full bg-foreground/70" />}
                    <span className="w-6 text-right text-2xs tabular-nums text-muted-foreground">
                      {ticket.age}
                    </span>
                  </Row>
                  {active &&
                    ticket.sessions.map((session) => (
                      <SessionRow key={session.role} session={session} indent={28} />
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
