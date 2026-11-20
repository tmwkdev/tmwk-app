import React from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import type { TmwkChatEvent as TmwkChatEventPayload } from '../../../../../shared/tmwk/tmwk-chat-event'
import { TmwkChatEvent } from './TmwkChatEvent'

const REQUEST: TmwkChatEventPayload = {
  tmwk: 'ticket-request',
  ticketId: 'tk_1a2b3c4d',
  title: 'Fix stale avatars after account switch',
  words:
    'Fix stale avatars after account switch\nAvatars stay stale after switching GitHub accounts until restart. Make the sidebar and PR reviewers pick up the new account right away.',
  project: { repoId: 'r-mac', name: 'tmwk-app' },
  runOn: 'auto',
  agent: 'claude',
  source: 'https://github.com/tmwkdev/tmwk-app/issues/431',
  requestedAt: '2026-11-20T10:48:00'
}

const DELEGATED: TmwkChatEventPayload = {
  tmwk: 'ticket-lines',
  ticketId: 'tk_1a2b3c4d',
  lines: [
    { kind: 'brief', text: 'Brief ready', at: '2026-11-20T10:48:30' },
    {
      kind: 'delegated',
      text: 'Delegated to claude on mbp',
      at: '2026-11-20T10:49:00',
      agent: 'claude',
      host: 'mbp'
    }
  ]
}

const FAILED: TmwkChatEventPayload = {
  tmwk: 'ticket-lines',
  ticketId: 'tk_1a2b3c4d',
  lines: [
    { kind: 'brief', text: 'Brief ready', at: '2026-11-20T10:48:30' },
    {
      kind: 'failed',
      text: "Couldn't start at worker_start: repository not found on mbp",
      at: '2026-11-20T10:49:00'
    }
  ]
}

/** The spike's Chat column: prose on the canvas, events between messages. */
function Thread({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="native-chat-appearance flex justify-center bg-background px-6 py-5">
      <div className="flex w-full max-w-[640px] flex-col gap-4 text-sm leading-6 text-chat-foreground">
        <div>
          Three things. New settings page asks whether to keep the legacy shortcuts panel. Release
          notes for 1.5 stopped because the docs deploy token expired. PR #412 is ready to review.
        </div>
        {children}
      </div>
    </div>
  )
}

const openTicket = (): void => {}

export const delegated = defineFixture({
  width: 760,
  render: () => (
    <Thread>
      <TmwkChatEvent event={REQUEST} />
      <div>Picked it up. The brief: reproduce with two accounts first, then open a draft PR.</div>
      <TmwkChatEvent event={DELEGATED} onOpenTicket={openTicket} />
    </Thread>
  )
})

export const couldNotStart = defineFixture({
  width: 760,
  render: () => (
    <Thread>
      <TmwkChatEvent event={REQUEST} />
      <TmwkChatEvent event={FAILED} onOpenTicket={openTicket} />
    </Thread>
  )
})

export const requestOnly = defineFixture({
  width: 760,
  render: () => (
    <Thread>
      <TmwkChatEvent event={{ ...REQUEST, words: REQUEST.title, source: undefined }} />
    </Thread>
  )
})
