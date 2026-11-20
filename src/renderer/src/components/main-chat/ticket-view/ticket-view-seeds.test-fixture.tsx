import React from 'react'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TicketDecision, TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import type {
  TmwkTicketEvent,
  TmwkTicketRecord
} from '../../../../../shared/tmwk/tmwk-ticket-record'
import {
  noop,
  session,
  SidebarFrame,
  typicalRows
} from '../tickets/ticket-sidebar-seeds.test-fixture'
import { TicketView, type TicketViewProps } from './TicketView'

// Fixture seeds for the ticket view, from the M4 spike's T4 (f1-ticket-open); illustrative only.

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const event = (
  minutes: number,
  kind: TmwkTicketEvent['kind'],
  text: string,
  extra: Partial<TmwkTicketEvent> = {}
): TmwkTicketEvent => ({ at: minutesAgo(minutes), kind, text, ...extra })

// The first typical row is the spike's "New settings page".
const [settingsRow] = typicalRows

const SETTINGS_HISTORY: TmwkTicketEvent[] = [
  event(
    42,
    'requested',
    'Start working on the new settings page. Use the approach we discussed yesterday.'
  ),
  event(41, 'asked', 'Keep the old page reachable from the menu while this lands?', {
    questionId: 'q_old'
  }),
  event(40, 'question-closed', 'Closed by the next attempt', { questionId: 'q_old' }),
  event(40, 'brief', 'Brief ready'),
  event(40, 'attempt-started', 'Delegated to claude on MBP', { dispatchId: 'd_1' }),
  event(
    14,
    'attempt-settled',
    JSON.stringify({
      subject:
        'Moved the sections to one scroll view and kept search. The shortcut list is ported last.',
      body: 'Review finished: 2 comments, both addressed.'
    }),
    { dispatchId: 'd_1' }
  ),
  event(12, 'attempt-started', 'Delegated to claude on MBP', { dispatchId: 'd_2' }),
  event(9, 'attempt-started', 'Delegated to codex on MBP', { dispatchId: 'd_3' })
]

function record(id: string, title: string, history: TmwkTicketEvent[]): TmwkTicketRecord {
  return {
    id,
    title,
    words: history[0]?.text ?? '',
    goal: 'Replace the settings dialog with one scrolling page. Keep search; port the shortcut list last. Done when every setting is reachable and the shortcut list covers every binding.',
    projectId: 'tmwk-app',
    status: 'active',
    origin: 'tmwk',
    attempts: [
      {
        dispatchId: 'd_1',
        agent: 'claude',
        host: 'mbp',
        startedAt: minutesAgo(40),
        settledAt: minutesAgo(14),
        outcome: 'completed'
      },
      {
        dispatchId: 'd_2',
        agent: 'claude',
        host: 'mbp',
        startedAt: minutesAgo(12),
        worktreeId: 'repo::/settings'
      },
      { dispatchId: 'd_3', agent: 'codex', host: 'mbp', startedAt: minutesAgo(9) }
    ],
    history,
    createdAt: minutesAgo(42),
    changedAt: 50
  }
}

export const GATE: TicketDecision = {
  kind: 'gate',
  id: 'gate_1',
  text: 'Keep the legacy shortcuts panel?',
  recommend:
    'It duplicates the new list. I recommend removing it now: nothing links to it and the new list covers every binding.',
  options: ['Remove it', 'Keep for one release'],
  askedAt: minutesAgo(4)
}

const baseRow: TicketRowModel = {
  ...settingsRow,
  startedAt: minutesAgo(42),
  lastActivityAt: minutesAgo(1),
  branch: 'tmwk/settings-page',
  sessions: [
    { ...session('settings-owner', 'claude', 'question'), worktreeId: 'repo::/settings' },
    session('settings-tests', 'claude', 'working', 'Shortcut tests', 'sonnet-5.5'),
    session('settings-review', 'codex', 'done', 'Review')
  ]
}

export const decisionView: TmwkTicketView = {
  version: 50,
  ticket: record('settings', 'New settings page', SETTINGS_HISTORY),
  row: baseRow,
  decision: GATE
}

export const runningView: TmwkTicketView = {
  ...decisionView,
  row: {
    ...baseRow,
    state: 'running',
    reason: null,
    sessions: baseRow.sessions.map((s, index) => ({
      ...s,
      status: index === 2 ? 'done' : 'working'
    }))
  },
  decision: null
}

export const doneView: TmwkTicketView = {
  ...decisionView,
  ticket: {
    ...record('settings', 'New settings page', [
      ...SETTINGS_HISTORY,
      event(
        3,
        'attempt-settled',
        JSON.stringify({
          subject: 'Removed the legacy shortcuts panel and opened PR #431.',
          body: 'Tests pass; the new list covers every binding.'
        }),
        { dispatchId: 'd_2' }
      ),
      event(1, 'accepted', 'Accepted')
    ]),
    status: 'accepted',
    acceptedAt: minutesAgo(1)
  },
  row: {
    ...baseRow,
    state: 'done',
    reason: null,
    pr: { number: 431, url: null },
    sessions: baseRow.sessions.map((s) => ({ ...s, status: 'done' }))
  },
  decision: null
}

const actions: TicketViewProps['actions'] = {
  onAccept: undefined,
  onStop: noop,
  onOpenInChat: noop,
  onCopyId: noop
}

/** The ticket view beside the Tickets sidebar, in the spike's 1248 × 760 window. */
export function TicketWindow({
  view,
  width,
  sidebar = true
}: {
  view: TmwkTicketView
  width: number
  sidebar?: boolean
}): React.JSX.Element {
  return (
    <div className="flex" style={{ width, height: 760 }}>
      <style>{'#component-fixture-frame { padding: 0; }'}</style>
      {sidebar && (
        <SidebarFrame
          height={760}
          selectedId={view.ticket.id}
          rows={typicalRows.map((row) => (row.id === view.row.id ? view.row : row))}
        />
      )}
      <div className="min-w-0 flex-1 border-y border-r border-border">
        <TicketView
          view={view}
          actions={{
            ...actions,
            onAccept: view.row.state === 'result' ? noop : undefined,
            onStop: view.row.state === 'done' ? undefined : noop
          }}
          onOpenSession={noop}
          onWatchAll={noop}
          onAnswer={noop}
          onMessage={noop}
        />
      </div>
    </div>
  )
}
