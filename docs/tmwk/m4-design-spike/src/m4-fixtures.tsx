import React from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { busyAll, disconnected, empty, quiet, typical } from './m4-data'
import { Board, Column, Style } from './m4-kit'
import { TicketTree } from './m4-directions'
import { DIRECTIONS, TicketsPageMain, TicketsPageSidebar } from './m4-directions-more'
import { TicketConversation, TicketPage } from './m4-ticket-views'
import { TicketWithRail, WatchAll } from './m4-ticket-rail'
import { AttentionList, ChatOnTop, QueueAndChat, Shelf } from './m4-finalists'
import type { ListProps } from './m4-finalists'

const store = {
  settings: {
    ...getDefaultSettings('/tmp/m4-spike'),
    showTasksButton: false,
    showMobileButton: false,
    showAutomationsButton: false
  },
  activeView: 'terminal' as const,
  sidebarOpen: true,
  setupGuideSidebarDismissed: true,
  worktreeCardsIntroNoticeSeen: true,
  worktreeCardsUpdateNoticeSeen: true
}

function single(index: number) {
  const [, , , Component] = DIRECTIONS[index]
  return defineFixture({
    width: index === 6 ? 320 : 280,
    store,
    render: () => (
      <>
        <Style />
        <Component tickets={typical} selected="settings" />
      </>
    )
  })
}

export const wideA = single(0)
export const wideB = single(1)
export const wideC = single(2)
export const wideD = single(3)
export const wideE = single(4)
export const wideF = single(5)
export const wideG = single(6)

export const wideH = defineFixture({
  width: 1240,
  store,
  render: () => (
    <div className="flex">
      <Style />
      <TicketsPageSidebar tickets={typical} />
      <TicketsPageMain tickets={typical} />
    </div>
  )
})

function sheet(from: number, to: number, title: string) {
  return defineFixture({
    width: 48 + (to - from) * 300 + (to > 6 ? 40 : 0),
    store,
    render: () => (
      <Board
        title={title}
        note="Same eight tickets in every sidebar: one decision, one stop, one result, two running, two ongoing, one accepted. The New settings page ticket is selected where a direction has a selection."
      >
        {DIRECTIONS.slice(from, to).map(([key, label, note, Component]) => (
          <Column key={key} title={label} note={note}>
            <Component tickets={typical} selected="settings" height={700} />
          </Column>
        ))}
      </Board>
    )
  })
}

export const wideSheet1 = sheet(0, 4, 'M4 wide set · A–D')
export const wideSheet2 = sheet(4, 7, 'M4 wide set · E–G')

const settingsTicket = typical[0]
const treeSidebar = <TicketTree tickets={typical} selected="settings" />

export const openPage = defineFixture({
  width: 1240,
  store,
  render: () => (
    <>
      <Style />
      <TicketPage ticket={settingsTicket} sidebar={treeSidebar} />
    </>
  )
})

export const openConversation = defineFixture({
  ...openPage,
  render: () => (
    <>
      <Style />
      <TicketConversation ticket={settingsTicket} sidebar={treeSidebar} />
    </>
  )
})

export const openWatch = defineFixture({
  ...openPage,
  render: () => (
    <>
      <Style />
      <WatchAll ticket={settingsTicket} sidebar={treeSidebar} />
    </>
  )
})

// Round 2 finalists ---------------------------------------------------------------

type State = {
  key: string
  title: string
  note: string
  tickets: typeof typical
  selected?: string
  expanded?: string
  hover?: string
}

const STATES: State[] = [
  { key: 'typical', title: 'Typical', note: 'Eight tickets; nothing selected.', tickets: typical },
  {
    key: 'open',
    title: 'Ticket open',
    note: 'New settings page selected, sessions disclosed.',
    tickets: typical,
    selected: 'settings',
    expanded: 'settings'
  },
  {
    key: 'busy',
    title: 'Busy · 18 tickets',
    note: 'Six need you, one long title, one ongoing decision, one host unreachable.',
    tickets: busyAll,
    hover: 'store'
  },
  { key: 'quiet', title: 'Nothing needs you', note: 'Only quiet work.', tickets: quiet },
  {
    key: 'offline',
    title: 'MBP unreachable',
    note: 'Last known state; open questions stay.',
    tickets: disconnected
  },
  { key: 'empty', title: 'Empty', note: 'First launch.', tickets: empty }
]

function finalistSheet(
  Component: React.ComponentType<ListProps & { chatActive?: boolean }>,
  title: string,
  keys: string[],
  chatActive = false
) {
  return defineFixture({
    width: 48 + keys.length * 300,
    store,
    render: () => (
      <Board title={title}>
        {STATES.filter((state) => keys.includes(state.key)).map((state) => (
          <Column key={state.key} title={state.title} note={state.note}>
            <Component
              tickets={state.tickets}
              selected={state.selected}
              expanded={state.expanded}
              hover={state.hover}
              height={700}
              {...(chatActive ? { chatActive: !state.selected } : {})}
            />
          </Column>
        ))}
      </Board>
    )
  })
}

export const f1StatesA = finalistSheet(AttentionList, 'Finalist 1 · Attention list', [
  'typical',
  'open',
  'busy'
])
export const f1StatesB = finalistSheet(AttentionList, 'Finalist 1 · Attention list', [
  'quiet',
  'offline',
  'empty'
])
export const f2StatesA = finalistSheet(
  ChatOnTop,
  'Finalist 2 · Chat on top',
  ['typical', 'open', 'busy'],
  true
)
export const f2StatesB = finalistSheet(
  ChatOnTop,
  'Finalist 2 · Chat on top',
  ['quiet', 'offline', 'empty'],
  true
)

function shelfWindow(tickets: typeof typical, selected?: string) {
  return defineFixture({
    width: 1240,
    store: { ...store, activeView: 'main' as const },
    render: () => (
      <div className="flex" style={{ height: 760 }}>
        <Style />
        <Shelf tickets={tickets} selected={selected} expanded={selected} />
        <QueueAndChat tickets={tickets} />
      </div>
    )
  })
}

export const f3Typical = shelfWindow(typical)
export const f3Busy = shelfWindow(busyAll)
export const f3Quiet = shelfWindow(quiet)

export const f1TicketOpen = defineFixture({
  width: 1240,
  store,
  render: () => (
    <>
      <Style />
      <TicketWithRail
        ticket={settingsTicket}
        sidebar={<AttentionList tickets={typical} selected="settings" />}
      />
    </>
  )
})

export const f1ChatOpen = defineFixture({
  width: 1240,
  store: { ...store, activeView: 'main' as const },
  render: () => (
    <div className="flex" style={{ height: 760 }}>
      <Style />
      <AttentionList tickets={typical} />
      <QueueAndChat tickets={typical} showQueue={false} />
    </div>
  )
})
