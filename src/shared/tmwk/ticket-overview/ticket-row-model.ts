import type { TerminalAgent } from '../../agent-status/identity/terminal-agent'

/** Where a ticket stands for its owner; the first three are the Needs you section. */
export type TicketState = 'decision' | 'stop' | 'result' | 'running' | 'waiting' | 'paused' | 'done'

export type TicketSessionStatus = 'working' | 'waiting' | 'done' | 'failed' | 'idle' | 'question'

export type TicketRowSession = {
  id: string
  agent: TerminalAgent | null
  role: string
  model: string | null
  status: TicketSessionStatus
  worktreeId: string | null
  tabId: string | null
  paneKey: string | null
  executionHostId: string | null
}

export type TicketRowHost = {
  id: string
  label: string
  reachable: boolean
  lastReportAt: string | null
}

/** One sidebar row, built on the home host by `tmwk.ticketOverview`; plain JSON so it crosses RPC. */
export type TicketRowModel = {
  id: string
  title: string
  projectId: string | null
  projectName: string | null
  state: TicketState
  /** The question, blocker, result, or current activity. */
  reason: string | null
  kind: 'ongoing' | null
  /** What an ongoing ticket handled on its own. */
  handled: string | null
  host: TicketRowHost | null
  sessions: TicketRowSession[]
  startedAt: string
  lastActivityAt: string | null
  branch: string | null
  pr: { number: number; url: string | null } | null
  /** Store version of the last observable change; newer is larger. */
  changedAt: number
}
