export type MainSessionRecord = {
  sessionId: string
  agent: string
  createdAt: string
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
    typeof record.createdAt === 'string'
  )
}
