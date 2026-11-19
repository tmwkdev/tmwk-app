import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { postAwayDigest } from '../away/post-away-digest'
import { readDevEnvOverride } from '../dev-env-override'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { onMainTurn } from '../rollover/main-session-turns'
import { openTmwkPresenceStore, openTmwkTicketStore } from '../store/open-tmwk-store'
import { setUserPresenceCheck } from '../summary/refresh-working-summary'
import {
  AWAY_AFTER_DEFAULT_MS,
  applyPresenceEvent,
  tickPresence,
  type PresenceEvent,
  type PresenceState,
  type PresenceStatus
} from './presence-state'
import { readUserTurnStart } from './user-turn-presence'

let mirror: PresenceState | null = null
let pendingReturnedFrom: string | null = null
let digestInFlight = false

export function resolveAwayAfterMs(env: NodeJS.ProcessEnv = process.env): number {
  const seconds = Number(readDevEnvOverride('TMWK_AWAY_AFTER_SECONDS', env))
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : AWAY_AFTER_DEFAULT_MS
}

/** Reads the in-memory copy of the stored state; a host that has seen no presence yet is not away. */
export function isUserAway(): boolean {
  return (
    mirror !== null &&
    tickPresence(mirror, new Date().toISOString(), resolveAwayAfterMs()).status === 'away'
  )
}

export async function readPresenceStatus(): Promise<PresenceStatus> {
  const state = await openTmwkPresenceStore().read()
  return state === null
    ? 'present'
    : tickPresence(state, new Date().toISOString(), resolveAwayAfterMs()).status
}

/** A return stays pending, in memory, until a digest attempt succeeds; the next presence event retries it. */
function retryPendingDigest(runtime: OrcaRuntimeService): void {
  const awaySince = pendingReturnedFrom
  if (awaySince === null || digestInFlight) {
    return
  }
  digestInFlight = true
  postAwayDigest(runtime, awaySince)
    .then((posted) => {
      if (posted && pendingReturnedFrom === awaySince) {
        pendingReturnedFrom = null
      }
    })
    .catch((error: unknown) => console.error('[tmwk] away digest failed:', error))
    .finally(() => {
      digestInFlight = false
    })
}

/** Records presence and, on the first presence after an absence, posts the away digest without waiting for it. */
export async function recordPresence(
  runtime: OrcaRuntimeService,
  event: PresenceEvent
): Promise<PresenceStatus> {
  const step = await openTmwkPresenceStore().update(
    async () => (await openTmwkTicketStore().list()).version,
    (state) => {
      const next = applyPresenceEvent(state, event, resolveAwayAfterMs())
      return { state: next.state, result: next }
    }
  )
  mirror = step.state
  if (step.status === 'returned' && step.returnedFrom !== null) {
    pendingReturnedFrom ??= step.returnedFrom
  }
  retryPendingDigest(runtime)
  return step.status
}

/** A completed pinned-session turn that a person started counts as presence at its start. */
export function startPresenceTracking(runtime: OrcaRuntimeService): void {
  void openTmwkPresenceStore()
    .read()
    .then((state) => {
      mirror ??= state
    })
    .catch((error: unknown) => console.error('[tmwk] presence read failed:', error))
  setUserPresenceCheck(() => !isUserAway())
  onMainTurn(runtime, (event) => {
    if (event.type !== 'completion') {
      return
    }
    void readUserTurnStart(createTmwkRpc(runtime), event.pinnedSessionId)
      .then((startedAt) =>
        startedAt === null
          ? undefined
          : recordPresence(runtime, { kind: 'user-turn', at: new Date(startedAt).toISOString() })
      )
      .catch((error: unknown) => console.error('[tmwk] user turn presence failed:', error))
  })
}
