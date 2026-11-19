import type { MainSessionRecord } from './main-session-record'

export type MainSessionPendingPhase = 'saving' | 'starting'

export type MainSessionPending = {
  kind: 'switch' | 'rollover'
  agent: string
  /** Saving: flush and summary refresh. Starting: the replacement launch. */
  phase: MainSessionPendingPhase
}

export type MainSessionState = {
  pin: MainSessionRecord | null
  agents: string[]
  pending: MainSessionPending | null
  lastFailure?: string
}

export type MainSessionRolloverResult = {
  state: 'scheduled' | 'running'
  sessionId: string
}
