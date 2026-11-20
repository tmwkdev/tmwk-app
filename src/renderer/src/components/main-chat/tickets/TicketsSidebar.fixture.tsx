import React from 'react'
import { PanelLeft } from 'lucide-react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import SidebarNav from '@/components/sidebar/chrome/SidebarNav'
import SidebarToolbar from '@/components/sidebar/chrome/SidebarToolbar'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type {
  TicketRowHost,
  TicketRowModel,
  TicketRowSession,
  TicketSessionStatus,
  TicketState
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { TicketsSidebar, type TicketsSidebarProps } from './TicketsSidebar'

// Seeded from the M4 design spike's m4-data.ts; illustrative only.

const LAST_REPORT = new Date(2026, 10, 19, 10, 42).toISOString()
const host = (id: string, label: string, reachable = true): TicketRowHost => ({
  id,
  label,
  reachable,
  lastReportAt: LAST_REPORT
})
const LAPTOP = host('laptop', 'Laptop')
const MBP = host('mbp', 'MBP')
const ONA = host('ona', 'Ona')

type Agent = 'claude' | 'codex'
const session = (
  id: string,
  agent: Agent,
  status: TicketSessionStatus,
  role = 'Owner',
  model: string | null = agent === 'codex' ? 'gpt-6' : 'opus-5.5'
): TicketRowSession => ({
  id,
  agent,
  role,
  model,
  status,
  worktreeId: null,
  tabId: null,
  paneKey: null,
  executionHostId: null
})

const ticket = (
  id: string,
  title: string,
  project: string,
  state: TicketState,
  reason: string | null,
  rowHost: TicketRowHost,
  changedAt: number,
  extra: Partial<TicketRowModel> = {}
): TicketRowModel => ({
  id,
  title,
  projectId: project,
  projectName: project,
  state,
  reason,
  kind: null,
  handled: null,
  host: rowHost,
  sessions: [session(`${id}-owner`, 'claude', state === 'running' ? 'working' : 'done')],
  startedAt: '2026-11-19T09:00:00.000Z',
  lastActivityAt: null,
  branch: null,
  pr: null,
  changedAt,
  ...extra
})

const typicalRows: TicketRowModel[] = [
  ticket(
    'settings',
    'New settings page',
    'tmwk-app',
    'decision',
    'Keep the legacy shortcuts panel?',
    MBP,
    50,
    {
      sessions: [
        session('settings-owner', 'claude', 'question'),
        session('settings-tests', 'claude', 'working', 'Shortcut tests', 'sonnet-5.5'),
        session('settings-review', 'codex', 'done', 'Review')
      ]
    }
  ),
  ticket(
    'release',
    'Release notes for 1.5',
    'website',
    'stop',
    "Can't publish: the docs deploy token expired",
    ONA,
    50,
    {
      sessions: [session('release-owner', 'codex', 'failed')]
    }
  ),
  ticket(
    'flaky',
    'Checks link opens the wrong run',
    'tmwk-app',
    'result',
    'PR #412 ready to review',
    MBP,
    50,
    {
      pr: { number: 412, url: null },
      sessions: [
        session('flaky-owner', 'claude', 'done'),
        session('flaky-review', 'codex', 'done', 'Review')
      ]
    }
  ),
  ticket(
    'store',
    'Ticket store v2 migration',
    'tmwk-app',
    'running',
    'Writing migration tests',
    LAPTOP,
    30,
    {
      sessions: [
        session('store-owner', 'claude', 'working'),
        session('store-edge', 'codex', 'working', 'Edge cases')
      ]
    }
  ),
  ticket(
    'auth',
    'Review auth refresh PR #418',
    'tmwk-app',
    'running',
    'Reading the token refresh path',
    MBP,
    29,
    {
      sessions: [session('auth-owner', 'codex', 'working')]
    }
  ),
  ticket('ci', 'Keep CI green on open PRs', 'tmwk-app', 'waiting', 'Watching 3 PRs', MBP, 28, {
    kind: 'ongoing',
    handled: 'Fixed 2 CI failures today',
    sessions: [session('ci-owner', 'codex', 'waiting')]
  }),
  ticket(
    'deps',
    'Weekly dependency updates',
    'website',
    'waiting',
    'Next check Monday 9:00',
    MBP,
    27,
    {
      kind: 'ongoing',
      sessions: [session('deps-owner', 'claude', 'idle', 'Owner', 'sonnet-5.5')]
    }
  ),
  ticket('greet', 'Rename greet to hello', 'demo', 'done', 'Accepted · PR #37 merged', LAPTOP, 1, {
    pr: { number: 37, url: null }
  })
]

const extraRows: TicketRowModel[] = [
  ticket(
    'mobile',
    'Mobile ticket list',
    'tmwk-app',
    'running',
    'Sketching the list screen',
    MBP,
    26
  ),
  ticket(
    'digest',
    'Away digest wording',
    'tmwk-app',
    'running',
    'Comparing two digest drafts',
    LAPTOP,
    25
  ),
  ticket(
    'codex',
    'Codex delegation end to end',
    'tmwk-app',
    'running',
    'Waiting for the worker to start',
    MBP,
    24
  ),
  ticket('search', 'Docs search index', 'website', 'running', 'Rebuilding the index', MBP, 23),
  ticket(
    'electron',
    'Upgrade Electron to 39',
    'tmwk-app',
    'result',
    'PR #420 ready to review',
    MBP,
    40
  ),
  ticket('pricing', 'Pricing page copy', 'website', 'done', 'Accepted', LAPTOP, 1),
  ticket(
    'windows',
    'Fix Windows path quoting',
    'tmwk-app',
    'decision',
    'Use cmd or PowerShell for hooks?',
    MBP,
    40,
    {
      sessions: [session('windows-owner', 'codex', 'question')]
    }
  )
]

const busyRows: TicketRowModel[] = [
  ticket(
    'readme-website',
    'Update the README',
    'website',
    'running',
    'Rewriting the setup section',
    MBP,
    35
  ),
  ticket(
    'readme-app',
    'Update the README',
    'tmwk-app',
    'running',
    'Adding the tmwk skill section',
    MBP,
    34
  ),
  ticket(
    'deploys',
    'Watch website deploys',
    'website',
    'decision',
    'Roll back the 14:02 deploy? Error rate is 3%',
    MBP,
    60,
    {
      kind: 'ongoing',
      sessions: [session('deploys-owner', 'codex', 'question')]
    }
  ),
  ticket(
    'long',
    'Make the mobile session route open hidden folder workspaces from the Home feed',
    'tmwk-app',
    'running',
    'Tracing the session route',
    MBP,
    33
  ),
  ticket(
    'backoff',
    'Summary refresh backoff',
    'tmwk-app',
    'paused',
    null,
    host('mini', 'Mini', false),
    32,
    {
      sessions: [session('backoff-owner', 'claude', 'idle', 'Owner', 'sonnet-5.5')]
    }
  ),
  ...typicalRows,
  ...extraRows
]

const quietRows = typicalRows.filter((row) =>
  ['store', 'auth', 'ci', 'deps', 'greet'].includes(row.id)
)

const OFFLINE_MBP = host('mbp', 'MBP', false)
const unreachableRows = typicalRows.map((row): TicketRowModel => {
  if (row.host?.id !== 'mbp' || row.state === 'done') {
    return row
  }
  const paused = row.state === 'running' || row.state === 'waiting'
  return { ...row, host: OFFLINE_MBP, ...(paused ? { state: 'paused' as const } : {}) }
})

const store = {
  settings: {
    ...getDefaultSettings('/tmp/tmwk-tickets-fixture'),
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

const noop = (): void => {}

/** The spike's 280-wide frame: the real Search row and the real bottom toolbar with the Chat dock. */
function SidebarFrame(props: Partial<TicketsSidebarProps>): React.JSX.Element {
  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden border border-worktree-sidebar-border bg-worktree-sidebar text-worktree-sidebar-foreground"
      style={{ width: 280, height: 700 }}
    >
      <style>{'#component-fixture-frame { padding: 0; }'}</style>
      <div className="flex h-10 shrink-0 items-center justify-end border-b border-worktree-sidebar-border px-4 text-muted-foreground">
        <PanelLeft size={16} />
      </div>
      <SidebarNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <TicketsSidebar
          rows={typicalRows}
          selectedId={null}
          onSelect={noop}
          onOpenSession={noop}
          onNewTicket={noop}
          projectFilterLabel={null}
          onProjectFilterClick={noop}
          onHandOffInChat={noop}
          {...props}
        />
      </div>
      <SidebarToolbar workspaceBoardOpen={false} onWorkspaceBoardToggle={noop} />
    </div>
  )
}

export const typical = defineFixture({ width: 282, store, render: () => <SidebarFrame /> })

export const selected = defineFixture({
  ...typical,
  render: () => <SidebarFrame selectedId="settings" />,
  interact: (frame) => {
    frame
      .querySelector<HTMLElement>('[data-ticket-item="ticket:settings"] [data-ticket-disclosure]')
      ?.click()
  }
})

export const busy = defineFixture({ ...typical, render: () => <SidebarFrame rows={busyRows} /> })

export const nothingNeedsYou = defineFixture({
  ...typical,
  render: () => <SidebarFrame rows={quietRows} />
})

export const hostUnreachable = defineFixture({
  ...typical,
  render: () => <SidebarFrame rows={unreachableRows} />
})

export const homeHostUnreachable = defineFixture({
  ...typical,
  render: () => <SidebarFrame hostUnreachable={{ label: 'MBP', lastReportAt: LAST_REPORT }} />
})

export const empty = defineFixture({ ...typical, render: () => <SidebarFrame rows={[]} /> })
