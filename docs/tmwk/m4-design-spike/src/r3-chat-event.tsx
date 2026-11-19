import React from 'react'
import { ArrowUp, ArrowUpRight, Github, Server, Sparkles, TicketPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import type { Ticket } from './m4-data'
import { typical } from './m4-data'
import { Agent } from './m4-kit'

export const REQUEST =
  'Avatars stay stale after switching GitHub accounts until restart. Make the sidebar and PR reviewers pick up the new account right away.'

const base: Ticket = {
  id: 'avatars',
  title: 'Fix stale avatars after account switch',
  project: 'tmwk-app',
  state: 'running',
  line: 'Owner starting',
  host: 'mbp',
  age: 'now',
  sessions: [
    {
      agent: 'claude',
      role: 'Owner',
      model: 'opus-5.5',
      status: 'working',
      age: 'now',
      owner: true
    }
  ]
}

const delegated: Ticket = { ...base, handled: 'Owner starting · just now' }
const asking: Ticket = {
  ...base,
  state: 'decision',
  line: 'Cancel avatar loads from the old account on switch?',
  sessions: []
}

export const withDelegated: Ticket[] = [...typical.slice(0, 3), delegated, ...typical.slice(3)]
export const withQuestion: Ticket[] = [asking, ...typical]

function Chip({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 text-2xs text-muted-foreground">
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  )
}

/** The request lands as an event in the conversation, not as a message bubble. */
export function TicketRequestEvent() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <TicketPlus className="size-3.5" />
        You requested a new ticket · 10:48
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="text-[13px] font-medium">Fix stale avatars after account switch</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{REQUEST}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>
            <span className="size-1.5 rounded-[2px] bg-muted-foreground" />
            tmwk-app
          </Chip>
          <Chip icon={Sparkles}>Run on Auto</Chip>
          <Chip>
            <Agent agent="claude" size={11} />
            Claude Code
          </Chip>
          <Chip icon={Github}>#431</Chip>
        </div>
      </div>
    </div>
  )
}

function SystemLine({ children, link }: { children: React.ReactNode; link?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Server className="size-3.5" />
      <span className="flex-1">{children}</span>
      {link && (
        <span className="inline-flex items-center gap-0.5 text-foreground/80">
          Open ticket
          <ArrowUpRight className="size-3" />
        </span>
      )}
    </div>
  )
}

function Thread({ variant }: { variant: 'delegated' | 'question' }) {
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-4 py-5 text-sm leading-6">
      <div className="self-end rounded-2xl bg-muted px-4 py-2">What needs me?</div>
      <div className="text-xs text-muted-foreground">10:41</div>
      <div className="-mt-3">
        Three things. New settings page asks whether to keep the legacy shortcuts panel. Release
        notes for 1.5 stopped because the docs deploy token expired. PR #412 is ready to review.
      </div>
      <TicketRequestEvent />
      {variant === 'delegated' ? (
        <>
          <div>
            Picked it up. The brief: reproduce with two accounts first, then open a draft PR.
          </div>
          <div className="flex flex-col gap-1.5">
            <SystemLine>Brief ready · 10:48</SystemLine>
            <SystemLine link>
              Delegated to Claude Code on mbp, where tmwk-app is checked out · 10:49
            </SystemLine>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            One thing before I brief an owner: PR reviewer avatars load in the background. When you
            switch accounts mid-load, should those loads be cancelled? I would cancel them;
            otherwise the old account’s avatars can flash back in.
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs">Cancel them (recommended)</Button>
            <Button size="xs" variant="outline">
              Let them finish
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Or answer in your own words. The ticket waits in Needs you until you do.
          </div>
        </div>
      )}
    </div>
  )
}

export function ChatPane({
  variant,
  className
}: {
  variant: 'delegated' | 'question'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col border-y border-r border-border bg-background text-foreground',
        className
      )}
    >
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4 text-sm font-medium">
        Chat
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6">
        <Thread variant={variant} />
        <div className="flex-1" />
        <div className="mb-5 w-full max-w-[640px] rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <div className="text-sm text-muted-foreground">Ask anything, or hand off work</div>
          <div className="mt-3 flex items-center justify-end">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
              <ArrowUp className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
