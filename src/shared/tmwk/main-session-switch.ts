import type { MainSessionRecord } from './main-session-record'

export type MainSessionPending = { kind: 'switch' | 'rollover'; agent: string }

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
