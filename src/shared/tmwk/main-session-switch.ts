import type { MainSessionRecord } from './main-session-record'

export type MainSessionState = {
  pin: MainSessionRecord | null
  agents: string[]
}
