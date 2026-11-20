import React from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import type { TmwkHealthView } from '../../../../../shared/tmwk/tmwk-health'
import { TmwkHealthPopover } from './TmwkHealthPopover'

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const seeded: TmwkHealthView = {
  windowDays: 7,
  failures: [
    {
      type: 'failure',
      kind: 'ticket-refresh',
      stage: 'snapshot',
      message: 'orchestration.runs unavailable: the runtime is restarting',
      at: minutesAgo(4),
      repeats: 6
    },
    {
      type: 'failure',
      kind: 'summary',
      stage: 'refresh',
      message: 'the summary came back empty',
      at: minutesAgo(95),
      repeats: 1
    },
    {
      type: 'failure',
      kind: 'rollover',
      stage: 'rollover',
      message: 'The main chat changed before the new session started.',
      code: 'session_changed',
      at: minutesAgo(60 * 30),
      repeats: 1
    },
    {
      type: 'failure',
      kind: 'main-session',
      stage: 'brief',
      message: 'agent.send timed out after 30000 ms',
      at: minutesAgo(60 * 70),
      repeats: 1
    }
  ],
  rollovers: { stored: 5, fallback: 1, stale: 0 },
  tickets: { completed: 12, failed: 2, lost: 1, open: 3 }
}

const healthy: TmwkHealthView = {
  windowDays: 7,
  failures: [],
  rollovers: { stored: 4, fallback: 0, stale: 0 },
  tickets: { completed: 9, failed: 0, lost: 0, open: 2 }
}

// The Chat header strip as MainChatAgentSwitcher draws it, with the Health popover open.
function ChatHeader({ view }: { view: TmwkHealthView | null }): React.JSX.Element {
  return (
    <div className="h-[440px] bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
        <span className="text-muted-foreground">Chat agent</span>
        <div className="h-7 w-40 rounded-md border border-input px-2 leading-7">Claude</div>
        <Button size="xs" variant="outline" disabled>
          Switch agent
        </Button>
        <span className="text-muted-foreground">
          Starts fresh. Your previous chat stays in history.
        </span>
        <span className="ml-auto">
          <TmwkHealthPopover view={view} failed={false} open onOpenChange={() => {}} />
        </span>
      </div>
    </div>
  )
}

export const failures = defineFixture({ width: 760, render: () => <ChatHeader view={seeded} /> })
export const none = defineFixture({ width: 760, render: () => <ChatHeader view={healthy} /> })
