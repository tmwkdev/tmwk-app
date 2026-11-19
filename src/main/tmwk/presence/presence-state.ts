export type PresenceState = {
  lastPresentAt: string | null
  awaySince: string | null
  digestVersion: number
}

export type PresenceEvent = { kind: 'user-turn' | 'view-visible'; at: string }
export type PresenceStatus = 'present' | 'away' | 'returned'

export type PresenceStep = {
  state: PresenceState
  status: PresenceStatus
  /** When the user was last present before a return; null unless `status` is `returned`. */
  returnedFrom: string | null
}

export const AWAY_AFTER_DEFAULT_MS = 30 * 60_000

/** An event never moves `lastPresentAt` backwards: a user turn is stamped at its start, which can precede a later view report. */
export function applyPresenceEvent(
  state: PresenceState,
  event: PresenceEvent,
  awayAfterMs: number
): PresenceStep {
  const at = Date.parse(event.at)
  const last = state.lastPresentAt === null ? null : Date.parse(state.lastPresentAt)
  if (last === null || at < last) {
    return {
      state: { ...state, lastPresentAt: last === null ? event.at : state.lastPresentAt },
      status: 'present',
      returnedFrom: null
    }
  }
  const wasAway = state.awaySince !== null || at - last >= awayAfterMs
  return {
    state: { ...state, lastPresentAt: event.at, awaySince: null },
    status: wasAway ? 'returned' : 'present',
    returnedFrom: wasAway ? (state.awaySince ?? state.lastPresentAt) : null
  }
}

/** The clock alone can only turn present into away; it never returns. */
export function tickPresence(state: PresenceState, now: string, awayAfterMs: number): PresenceStep {
  const last = state.lastPresentAt === null ? null : Date.parse(state.lastPresentAt)
  const away = state.awaySince !== null || (last !== null && Date.parse(now) - last >= awayAfterMs)
  return {
    state: away ? { ...state, awaySince: state.awaySince ?? state.lastPresentAt } : state,
    status: away ? 'away' : 'present',
    returnedFrom: null
  }
}
