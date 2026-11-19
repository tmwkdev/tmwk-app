import React from 'react'
import {
  ArrowUp,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  LayoutGrid,
  TerminalSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import type { Ticket } from './m4-data'
import { HOST_LABEL } from './m4-data'
import { Agent, SessionGlyph } from './m4-kit'
import { Decision, TicketHeader, WindowFrame, history } from './m4-ticket-views'

// T3 · Watch all sessions ------------------------------------------------------------

const paneText: Record<string, string[]> = {
  Owner: [
    '⏺ Waiting for your answer on the legacy panel.',
    '  Meanwhile: tests and review are running.',
    '',
    '> _'
  ],
  'Shortcut tests': [
    '⏺ Bash(pnpm test settings/shortcuts --maxWorkers=2)',
    '  ⎿  ✓ 14 passed · 1 todo',
    '⏺ Writing a test for the Windows binding labels…'
  ],
  Review: ['• Reviewed 9 files', '• 2 comments, both addressed by the owner', '• Finished']
}

export function WatchAll({ ticket, sidebar }: { ticket: Ticket; sidebar: React.ReactNode }) {
  return (
    <WindowFrame sidebar={sidebar}>
      <TicketHeader
        ticket={ticket}
        trailing={
          <Button size="sm" variant="ghost">
            Back to ticket
          </Button>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-px bg-border">
        {ticket.sessions.map((session, index) => (
          <div
            key={session.role}
            className={cn('flex min-h-0 flex-col bg-background', index === 0 && 'row-span-2')}
          >
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
              <SessionGlyph status={session.status} />
              <Agent agent={session.agent} size={12} />
              <span className="font-medium">{session.role}</span>
              <span className="font-mono text-muted-foreground">{session.model}</span>
              <span className="flex-1" />
              <TerminalSquare className="size-3.5 text-muted-foreground" />
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 overflow-hidden whitespace-pre p-3 font-mono text-xs leading-5 text-foreground/85">
              {(paneText[session.role] ?? []).join('\n')}
            </div>
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Type to {session.role === 'Owner' ? 'the owner' : session.role}; the owner sees it.
            </div>
          </div>
        ))}
      </div>
    </WindowFrame>
  )
}

// T4 · Recommended: the owner conversation with a quiet rail ------------------------

export function TicketWithRail({ ticket, sidebar }: { ticket: Ticket; sidebar: React.ReactNode }) {
  return (
    <WindowFrame sidebar={sidebar}>
      <TicketHeader ticket={ticket} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col items-center px-6">
          <div className="flex w-full max-w-[620px] flex-1 flex-col gap-3 py-5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="size-3" />
              Instructions and 14 earlier events
            </div>
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
                  <div
                    key={index}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
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
          <div className="mb-5 w-full max-w-[620px] rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
            <div className="text-sm text-muted-foreground">Message the owner</div>
            <div className="mt-3 flex items-center justify-end">
              <span className="flex size-7 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
                <ArrowUp className="size-4" />
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-60 shrink-0 flex-col gap-5 border-l border-border px-3 py-5">
          <div>
            <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">Sessions</div>
            {ticket.sessions.map((session) => (
              <div
                key={session.role}
                className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px]"
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
            <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">Code</div>
            <div className="flex h-8 items-center gap-2 px-2">
              <GitBranch className="size-4 text-muted-foreground" />
              <span className="truncate font-mono text-xs">tmwk/settings-page</span>
            </div>
            <div className="flex h-8 items-center gap-2 px-2 text-[13px] text-muted-foreground">
              <GitPullRequest className="size-4" />
              No PR yet
            </div>
          </div>
          <div>
            <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">Where</div>
            <div className="px-2 text-xs leading-5 text-muted-foreground">
              {HOST_LABEL[ticket.host]}, chosen because it is always-on and has the checkout. Last
              report 1m ago.
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  )
}
