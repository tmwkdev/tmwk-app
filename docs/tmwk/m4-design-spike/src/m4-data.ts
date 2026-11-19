// Seeded tickets for the M4 mockups. Illustrative only; no field here is read from a live runtime.

export type TicketState = 'decision' | 'stop' | 'result' | 'running' | 'ongoing' | 'paused' | 'done'
export type Agent = 'claude' | 'codex'
export type Host = 'laptop' | 'mbp' | 'ona'
export type SessionStatus = 'working' | 'waiting' | 'done' | 'failed' | 'idle' | 'question'

export type Session = {
  agent: Agent
  role: string
  model: string
  status: SessionStatus
  age: string
  owner?: boolean
}

export type Ticket = {
  id: string
  title: string
  project: string
  state: TicketState
  /** One line: the decision asked, the stop reason, the result, or current activity. */
  line: string
  host: Host
  age: string
  sessions: Session[]
  pr?: string
  changed?: boolean
  /** Ongoing is a kind of ticket, independent of its state. */
  ongoing?: boolean
  /** What an ongoing ticket handled on its own, shown while it is quiet. */
  handled?: string
  /** Its host is unreachable; the row shows last known state. */
  offline?: boolean
}

const owner = (agent: Agent, model: string, status: SessionStatus, age: string): Session => ({
  agent,
  role: 'Owner',
  model,
  status,
  age,
  owner: true
})

export const typical: Ticket[] = [
  {
    id: 'settings',
    title: 'New settings page',
    project: 'tmwk-app',
    state: 'decision',
    line: 'Keep the legacy shortcuts panel?',
    host: 'mbp',
    age: '4m',
    changed: true,
    sessions: [
      owner('claude', 'opus-5.5', 'question', '4m'),
      {
        agent: 'claude',
        role: 'Shortcut tests',
        model: 'sonnet-5.5',
        status: 'working',
        age: '2m'
      },
      { agent: 'codex', role: 'Review', model: 'gpt-6', status: 'done', age: '18m' }
    ]
  },
  {
    id: 'release',
    title: 'Release notes for 1.5',
    project: 'website',
    state: 'stop',
    line: "Can't publish: the docs deploy token expired",
    host: 'ona',
    age: '22m',
    changed: true,
    sessions: [owner('codex', 'gpt-6', 'failed', '22m')]
  },
  {
    id: 'flaky',
    title: 'Checks link opens the wrong run',
    project: 'tmwk-app',
    state: 'result',
    line: 'PR #412 ready to review',
    host: 'mbp',
    age: '9m',
    pr: '#412',
    changed: true,
    sessions: [
      owner('claude', 'opus-5.5', 'done', '9m'),
      { agent: 'codex', role: 'Review', model: 'gpt-6', status: 'done', age: '11m' }
    ]
  },
  {
    id: 'store',
    title: 'Ticket store v2 migration',
    project: 'tmwk-app',
    state: 'running',
    line: 'Writing migration tests',
    host: 'laptop',
    age: '12m',
    sessions: [
      owner('claude', 'opus-5.5', 'working', 'now'),
      { agent: 'codex', role: 'Edge cases', model: 'gpt-6', status: 'working', age: 'now' }
    ]
  },
  {
    id: 'auth',
    title: 'Review auth refresh PR #418',
    project: 'tmwk-app',
    state: 'running',
    line: 'Reading the token refresh path',
    host: 'mbp',
    age: '3m',
    pr: '#418',
    sessions: [owner('codex', 'gpt-6', 'working', 'now')]
  },
  {
    id: 'ci',
    title: 'Keep CI green on open PRs',
    project: 'tmwk-app',
    state: 'ongoing',
    line: 'Watching 3 PRs · fixed 2 failures today',
    host: 'mbp',
    age: '1h',
    changed: true,
    ongoing: true,
    handled: 'Fixed 2 CI failures today',
    sessions: [owner('codex', 'gpt-6', 'waiting', '1h')]
  },
  {
    id: 'deps',
    title: 'Weekly dependency updates',
    project: 'website',
    state: 'ongoing',
    line: 'Next check Monday 9:00',
    host: 'mbp',
    ongoing: true,
    age: '2d',
    sessions: [owner('claude', 'sonnet-5.5', 'idle', '2d')]
  },
  {
    id: 'greet',
    title: 'Rename greet to hello',
    project: 'demo',
    state: 'done',
    line: 'Accepted · PR #37 merged',
    host: 'laptop',
    age: '2h',
    pr: '#37',
    sessions: [owner('claude', 'sonnet-5.5', 'done', '2h')]
  }
]

const extra: Ticket[] = [
  ['Mobile ticket list', 'tmwk-app', 'running', 'Sketching the list screen', 'mbp', '6m', 'claude'],
  [
    'Away digest wording',
    'tmwk-app',
    'running',
    'Comparing two digest drafts',
    'laptop',
    '1m',
    'claude'
  ],
  [
    'Codex delegation end to end',
    'tmwk-app',
    'running',
    'Waiting for the worker to start',
    'mbp',
    '30s',
    'codex'
  ],
  ['Docs search index', 'website', 'running', 'Rebuilding the index', 'mbp', '8m', 'codex'],
  [
    'Upgrade Electron to 39',
    'tmwk-app',
    'result',
    'PR #420 ready to review',
    'mbp',
    '25m',
    'claude'
  ],
  ['Pricing page copy', 'website', 'done', 'Accepted', 'laptop', '5h', 'claude'],
  [
    'Fix Windows path quoting',
    'tmwk-app',
    'decision',
    'Use cmd or PowerShell for hooks?',
    'mbp',
    '1m',
    'codex'
  ]
].map(([title, project, state, line, host, age, agent], index) => ({
  id: `extra-${index}`,
  title,
  project,
  state: state as TicketState,
  line,
  host: host as Host,
  age,
  sessions: [
    owner(
      agent as Agent,
      agent === 'codex' ? 'gpt-6' : 'opus-5.5',
      state === 'running' ? 'working' : state === 'decision' ? 'question' : 'done',
      age
    )
  ]
}))

export const busy: Ticket[] = [...typical, ...extra]

export const quiet: Ticket[] = typical
  .filter((ticket) => ['store', 'auth', 'ci', 'deps', 'greet'].includes(ticket.id))
  .map((ticket) => ({ ...ticket, changed: false }))

export const empty: Ticket[] = []

export const ORDER: TicketState[] = [
  'decision',
  'stop',
  'result',
  'running',
  'ongoing',
  'paused',
  'done'
]

export function sortByAttention(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state))
}

export const needsMe = (ticket: Ticket): boolean =>
  ticket.state === 'decision' || ticket.state === 'stop' || ticket.state === 'result'

export const HOST_LABEL: Record<Host, string> = { laptop: 'Laptop', mbp: 'MBP', ona: 'Ona' }

export const STATE_LABEL: Record<TicketState, string> = {
  decision: 'Decision',
  stop: 'Stopped',
  result: 'Ready',
  running: 'Running',
  ongoing: 'Ongoing',
  paused: 'Paused',
  done: 'Done'
}

const readme = (project: string, agent: Agent, line: string): Ticket => ({
  id: `readme-${project}`,
  title: 'Update the README',
  project,
  state: 'running',
  line,
  host: 'mbp',
  age: '4m',
  sessions: [owner(agent, agent === 'codex' ? 'gpt-6' : 'opus-5.5', 'working', '4m')]
})

const busyExtra: Ticket[] = [
  readme('website', 'codex', 'Rewriting the setup section'),
  readme('tmwk-app', 'claude', 'Adding the tmwk skill section'),
  {
    id: 'deploys',
    title: 'Watch website deploys',
    project: 'website',
    state: 'decision',
    ongoing: true,
    line: 'Roll back the 14:02 deploy? Error rate is 3%',
    host: 'mbp',
    age: '2m',
    sessions: [owner('codex', 'gpt-6', 'question', '2m')]
  },
  {
    id: 'long',
    title: 'Make the mobile session route open hidden folder workspaces from the Home feed',
    project: 'tmwk-app',
    state: 'running',
    line: 'Tracing the session route',
    host: 'mbp',
    age: '5m',
    sessions: [owner('claude', 'opus-5.5', 'working', '5m')]
  },
  {
    id: 'offline',
    title: 'Summary refresh backoff',
    project: 'tmwk-app',
    state: 'paused',
    line: 'MBP unreachable · last report 10:42',
    host: 'mbp',
    age: '18m',
    sessions: [owner('claude', 'sonnet-5.5', 'idle', '18m')]
  }
]

export const busyAll: Ticket[] = [...busyExtra, ...busy]

export const disconnected: Ticket[] = typical.map((ticket) => {
  if (ticket.host !== 'mbp' || ticket.state === 'done') {
    return ticket
  }
  if (needsMe(ticket)) {
    return { ...ticket, offline: true }
  }
  return { ...ticket, state: 'paused' as TicketState, line: 'MBP unreachable · last report 10:42' }
})
