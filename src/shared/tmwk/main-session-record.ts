export const MAIN_SESSION_PREVIOUS_CAP = 20

export type MainSessionEndReason = 'switch' | 'rollover'

export type MainSessionPreviousEntry = {
  sessionId: string
  agent: string
  createdAt: string
  endedAt: string
  reason: MainSessionEndReason
}

export type MainSessionRecord = {
  sessionId: string
  agent: string
  createdAt: string
  /** Newest first, capped at MAIN_SESSION_PREVIOUS_CAP. */
  previous?: MainSessionPreviousEntry[]
  /** Set once the briefing notice reached this session; absent on the first session. */
  briefedAt?: string | null
}

function isPreviousEntry(value: unknown): value is MainSessionPreviousEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.sessionId === 'string' &&
    typeof entry.agent === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.endedAt === 'string' &&
    (entry.reason === 'switch' || entry.reason === 'rollover')
  )
}

export function isMainSessionRecord(value: unknown): value is MainSessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.sessionId === 'string' &&
    record.sessionId.length > 0 &&
    typeof record.agent === 'string' &&
    typeof record.createdAt === 'string' &&
    (record.previous === undefined ||
      (Array.isArray(record.previous) && record.previous.every(isPreviousEntry))) &&
    (record.briefedAt === undefined ||
      record.briefedAt === null ||
      typeof record.briefedAt === 'string')
  )
}
