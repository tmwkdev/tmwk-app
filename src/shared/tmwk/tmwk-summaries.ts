export type TmwkSummaryReason = 'refresh' | 'manual' | 'fallback'

export type TmwkSummary = {
  id: string
  text: string
  sessionId: string
  agent: string
  reason: TmwkSummaryReason
  createdAt: string
  inputHash: string | null
  /** The ticket store version this refresh had seen; absent before tickets were tracked. */
  ticketVersion?: number
}

export const TMWK_SUMMARY_MAX_CHARS = 4000

export function isTmwkSummary(value: unknown): value is TmwkSummary {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'agent' in value &&
    typeof value.agent === 'string' &&
    'reason' in value &&
    (value.reason === 'refresh' || value.reason === 'manual' || value.reason === 'fallback') &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    'inputHash' in value &&
    (value.inputHash === null || typeof value.inputHash === 'string') &&
    (!('ticketVersion' in value) || typeof value.ticketVersion === 'number')
  )
}
