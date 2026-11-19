import React from 'react'
import {
  ArrowUp,
  ChevronRight,
  GitBranch,
  GitPullRequest,
  LayoutGrid,
  MoreHorizontal,
  Pause
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import type { Ticket } from './m4-data'
import { HOST_LABEL, STATE_LABEL } from './m4-data'
import { Agent, SessionGlyph, StateGlyph } from './m4-kit'

type History = {
  who: string
  agent?: 'claude' | 'codex'
  when: string
  text: string
  kind?: 'you' | 'event' | 'ask'
}

export const history: History[] = [
  {
    who: 'You',
    when: '10:02',
    kind: 'you',
    text: 'Start working on the new settings page. Use the approach we discussed yesterday.'
  },
  {
    who: 'Owner',
    agent: 'claude',
    when: '10:04',
    text: 'Plan: move the sections to one scroll view, keep search, port the shortcut list last. Running on MBP: always-on and it already has the checkout.'
  },
  {
    who: 'Owner',
    agent: 'claude',
    when: '10:05',
    kind: 'event',
    text: 'Started Shortcut tests (Claude) and Review (Codex)'
  },
  {
    who: 'Review',
    agent: 'codex',
    when: '10:31',
    kind: 'event',
    text: 'Review finished: 2 comments, both addressed'
  },
  {
    who: 'Owner',
    agent: 'claude',
    when: '10:38',
    kind: 'ask',
    text: 'The legacy shortcuts panel duplicates the new list. Keep it for one release, or remove it now? I recommend removing it: nothing links to it and the new list covers every binding.'
  }
]

function Meta({ ticket }: { ticket: Ticket }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <StateGlyph state={ticket.state} />
        {STATE_LABEL[ticket.state]}
      </span>
      <span>{ticket.project}</span>
      <span>Started 40m ago</span>
    </div>
  )
}

export function Decision({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <StateGlyph state="decision" />
        Decision · asked 4m ago
      </div>
      <div className="mt-2 text-sm font-medium">Keep the legacy shortcuts panel?</div>
      {!compact && (
        <div className="mt-1 text-[13px] leading-5 text-muted-foreground">
          It duplicates the new list. I recommend removing it now: nothing links to it and the new
          list covers every binding.
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm">Remove it</Button>
        <Button size="sm" variant="outline">
          Keep for one release
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="ghost">
          Reply
        </Button>
      </div>
    </div>
  )
}

export function WindowFrame({
  sidebar,
  children
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex" style={{ height: 760 }}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col border-y border-r border-border bg-background text-foreground">
        {children}
      </div>
    </div>
  )
}

export function TicketHeader({ ticket, trailing }: { ticket: Ticket; trailing?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-border px-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold">{ticket.title}</div>
        <div className="mt-1">
          <Meta ticket={ticket} />
        </div>
      </div>
      {trailing ?? (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost">
            <Pause className="size-4" />
            Pause
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="More">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// T1 · Ticket page -------------------------------------------------------------

export function TicketPage({ ticket, sidebar }: { ticket: Ticket; sidebar: React.ReactNode }) {
  return (
    <WindowFrame sidebar={sidebar}>
      <TicketHeader ticket={ticket} />
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Decision />
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Work history</div>
            <div className="flex flex-col">
              {history.slice(0, 4).map((item, index) => (
                <div key={index} className="flex gap-3 py-1.5 text-[13px] leading-5">
                  <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                    {item.when}
                  </span>
                  <span className="w-16 shrink-0 text-muted-foreground">{item.who}</span>
                  <span
                    className={cn(
                      'min-w-0 flex-1',
                      item.kind === 'event' && 'text-muted-foreground'
                    )}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1 py-1.5 text-xs text-muted-foreground">
                <ChevronRight className="size-3" />
                Show instructions and 14 earlier events
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-64 shrink-0 flex-col gap-5">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Sessions</div>
            {ticket.sessions.map((session) => (
              <div
                key={session.role}
                className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
              >
                <SessionGlyph status={session.status} />
                <Agent agent={session.agent} />
                <span className="min-w-0 flex-1 truncate">{session.role}</span>
                <span className="font-mono text-2xs text-muted-foreground">{session.model}</span>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 w-full justify-start text-muted-foreground"
            >
              <LayoutGrid className="size-4" />
              Watch all
            </Button>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Code</div>
            <div className="flex h-8 items-center gap-2 px-2 text-[13px]">
              <GitBranch className="size-4 text-muted-foreground" />
              <span className="truncate font-mono text-xs">tmwk/settings-page</span>
            </div>
            <div className="flex h-8 items-center gap-2 px-2 text-[13px] text-muted-foreground">
              <GitPullRequest className="size-4" />
              No PR yet
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Where</div>
            <div className="px-2 text-xs leading-5 text-muted-foreground">
              {HOST_LABEL[ticket.host]}: always-on, already has the checkout.
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  )
}

// T2 · Ticket as a conversation with its owner -----------------------------------

export function TicketConversation({
  ticket,
  sidebar
}: {
  ticket: Ticket
  sidebar: React.ReactNode
}) {
  return (
    <WindowFrame sidebar={sidebar}>
      <TicketHeader
        ticket={ticket}
        trailing={
          <div className="flex items-center gap-1">
            {ticket.sessions.map((session) => (
              <Button key={session.role} size="sm" variant="ghost" className="gap-1.5 px-2">
                <SessionGlyph status={session.status} />
                <Agent agent={session.agent} size={12} />
                {session.role}
              </Button>
            ))}
            <Button size="icon-sm" variant="ghost" aria-label="Watch all sessions">
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6 py-5">
        <div className="flex w-full max-w-[680px] flex-1 flex-col gap-3">
          {history.map((item, index) => {
            if (item.kind === 'you') {
              return (
                <div key={index} className="self-end rounded-2xl bg-muted px-4 py-2 text-sm">
                  {item.text}
                </div>
              )
            }
            if (item.kind === 'event') {
              return (
                <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.agent && <Agent agent={item.agent} size={12} />}
                  {item.text}
                  <span className="tabular-nums">· {item.when}</span>
                </div>
              )
            }
            if (item.kind === 'ask') {
              return <Decision key={index} />
            }
            return (
              <div key={index} className="text-sm leading-6">
                {item.text}
              </div>
            )
          })}
        </div>
        <div className="w-full max-w-[680px] rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <div className="text-sm text-muted-foreground">Message the owner</div>
          <div className="mt-3 flex items-center justify-end">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
              <ArrowUp className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </WindowFrame>
  )
}
