import React from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import type { Ticket } from './m4-data'
import { busy, typical } from './m4-data'
import { Board, Column, SidebarFrame, Style } from './m4-kit'
import { TicketList } from './m4-finalists'
import { NewTicketSheet, TodaySheet } from './r3-new-ticket'
import { ChatPane, REQUEST, withDelegated, withQuestion } from './r3-chat-event'
import { TicketOptions, TodayOptions } from './r3-ticket-options'
import {
  CUSTOM_STATUS_ORDER,
  DEFAULT_STATUS_ORDER,
  GroupedSidebar,
  TicketsHeader
} from './r3-status-list'

const store = {
  settings: {
    ...getDefaultSettings('/tmp/m4-spike'),
    showTasksButton: false,
    showMobileButton: false,
    showAutomationsButton: false
  },
  activeView: 'main' as const,
  sidebarOpen: true,
  setupGuideSidebarDismissed: true,
  worktreeCardsIntroNoticeSeen: true,
  worktreeCardsUpdateNoticeSeen: true,
  repos: [
    {
      id: 'tmwk-app',
      path: '/Users/ty/tmwk-app',
      displayName: 'tmwk-app',
      badgeColor: '#64748b',
      addedAt: 0
    },
    {
      id: 'website',
      path: '/Users/ty/website',
      displayName: 'website',
      badgeColor: '#64748b',
      addedAt: 1
    }
  ]
}

const doneTickets: Ticket[] = busy
  .filter((ticket) => ticket.state === 'done')
  .concat([
    { ...typical[4], id: 'done-2', title: 'Pin the Electron version', state: 'done', pr: '#401' },
    {
      ...typical[4],
      id: 'done-3',
      title: 'Drop the old onboarding tour',
      state: 'done',
      host: 'laptop'
    }
  ])
const withDone = [...typical.filter((ticket) => ticket.state !== 'done'), ...doneTickets]

function AttentionSidebar({
  tickets,
  plus,
  filter,
  height = 760
}: {
  tickets: Ticket[]
  plus?: boolean
  filter?: string
  height?: number
}) {
  return (
    <SidebarFrame height={height}>
      <TicketsHeader plus={plus} filter={filter} />
      <TicketList tickets={tickets} />
    </SidebarFrame>
  )
}

// 1 · New ticket ------------------------------------------------------------------

export const newTicketSheet = defineFixture({
  width: 1240,
  store,
  render: () => (
    <div className="flex" style={{ height: 760 }}>
      <Style />
      <AttentionSidebar tickets={typical} plus filter="tmwk-app" />
      <div className="relative flex flex-1 items-start justify-center bg-black/50 pt-16">
        <NewTicketSheet
          draft={{
            description: REQUEST,
            project: 'tmwk-app',
            projectFromFilter: true,
            source: '#431 Avatars stay stale after switching accounts'
          }}
        />
      </div>
    </div>
  )
})

export const newTicketCompare = defineFixture({
  width: 1140,
  store,
  render: () => (
    <Board
      title="Create worktree → New ticket"
      note="Same parts, same order. The description becomes the main field and the only required one; naming the branch or worktree is gone because the owner picks it. Create from stays as optional context."
    >
      <Column title="Today · New worktree">
        <TodaySheet />
      </Column>
      <Column title="Proposed · New ticket (Run on open)">
        <NewTicketSheet draft={{ runOnOpen: true }} />
      </Column>
    </Board>
  )
})

function chatWindow(tickets: Ticket[], variant: 'delegated' | 'question') {
  return defineFixture({
    width: 1240,
    store,
    render: () => (
      <div className="flex" style={{ height: 760 }}>
        <Style />
        <AttentionSidebar tickets={tickets} filter="tmwk-app" />
        <ChatPane variant={variant} />
      </div>
    )
  })
}

export const newTicketChat = chatWindow(withDelegated, 'delegated')
export const newTicketClarify = chatWindow(withQuestion, 'question')

// 2 · Ticket options ---------------------------------------------------------------

export const optionsCompare = defineFixture({
  width: 720,
  store,
  render: () => (
    <Board title="Workspace options → Ticket options">
      <Column title="Today · Workspace options">
        <div style={{ width: 300 }}>
          <TodayOptions />
        </div>
      </Column>
      <Column title="Proposed · Ticket options">
        <div style={{ width: 300 }}>
          <TicketOptions />
        </div>
      </Column>
    </Board>
  )
})

export const optionsSubmenus = defineFixture({
  width: 1140,
  store,
  render: () => (
    <Board title="Ticket options · submenus">
      <Column title="Sort within a group">
        <div style={{ width: 520 }}>
          <TicketOptions open="sort" />
        </div>
      </Column>
      <Column title="Show on rows">
        <div style={{ width: 520 }}>
          <TicketOptions open="rows" />
        </div>
      </Column>
    </Board>
  )
})

export const optionsResults = defineFixture({
  width: 980,
  store,
  render: () => (
    <Board title="What the options do">
      <Column title="Default" note="Group by Attention, two lines with the reason.">
        <AttentionSidebar tickets={busy} height={700} />
      </Column>
      <Column title="Project, one line" note="Group by Project, one line, PR on rows.">
        <GroupedSidebar
          tickets={busy}
          grouping={{ kind: 'project' }}
          density="one"
          show={['pr']}
          collapsed={['Done']}
          height={700}
        />
      </Column>
      <Column title="Host, with details" note="Group by Host; agent and last activity on rows.">
        <GroupedSidebar
          tickets={typical}
          grouping={{ kind: 'host' }}
          show={['reason', 'agent', 'age']}
          height={700}
        />
      </Column>
    </Board>
  )
})

// 3 · Custom status order -----------------------------------------------------------

export const statusOrder = defineFixture({
  width: 1240,
  store,
  render: () => (
    <Board title="Group by Status · your own order">
      <Column
        title="Status order"
        note="Drag sections; the Needs you count is pinned and can't move."
      >
        <div style={{ width: 560 }}>
          <TicketOptions groupBy="Status" open="order" />
        </div>
      </Column>
      <Column title="Your order" note="Done, then Blocked, then the rest.">
        <GroupedSidebar
          tickets={withDone}
          grouping={{ kind: 'status', order: CUSTOM_STATUS_ORDER }}
          height={700}
        />
      </Column>
      <Column title="Default order" note="Needs you first, then the rest.">
        <GroupedSidebar
          tickets={withDone}
          grouping={{ kind: 'status', order: DEFAULT_STATUS_ORDER }}
          collapsed={['Done']}
          height={700}
        />
      </Column>
    </Board>
  )
})
