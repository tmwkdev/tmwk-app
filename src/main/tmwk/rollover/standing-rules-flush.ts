import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { sendMainNotice } from '../notices/send-main-notice'
import { onMainTurn } from './main-session-turns'
import { hasTurnInFlight } from './main-turn-in-flight'

export type FlushOutcome = 'skipped' | 'timeout' | 'done'

export const FLUSH_WAIT_MS = 2 * 60 * 1000

export const FLUSH_NOTICE = {
  subject: 'Save standing rules',
  body: [
    'This chat is about to be replaced by a fresh one.',
    'Save any standing rule the user stated that `orca tmwk preference list` does not have, with `orca tmwk preference set`, then stop.',
    'Append only: do not supersede or remove preferences, create tickets, or take any outward action.',
    'Reply with one short line.'
  ].join('\n')
}

type FlushState = { turnSinceFlush: boolean; absorbFlushCompletion: boolean }

const states = new WeakMap<OrcaRuntimeService, Map<string, FlushState>>()

function stateFor(runtime: OrcaRuntimeService, sessionId: string): FlushState {
  let sessions = states.get(runtime)
  if (!sessions) {
    sessions = new Map()
    states.set(runtime, sessions)
  }
  let state = sessions.get(sessionId)
  if (!state) {
    // A session seen for the first time may hold unsaved rules from before this process.
    state = { turnSinceFlush: true, absorbFlushCompletion: false }
    sessions.set(sessionId, state)
  }
  return state
}

/** Records which sessions completed a turn since their last flush; the flush's own completion does not count. */
export function trackFlushDue(runtime: OrcaRuntimeService): void {
  onMainTurn(runtime, (event) => {
    if (event.type !== 'completion') {
      return
    }
    const state = stateFor(runtime, event.pinnedSessionId)
    if (state.absorbFlushCompletion) {
      state.absorbFlushCompletion = false
      return
    }
    state.turnSinceFlush = true
  })
}

/** Sends the flush notice and waits for the session's next completion; never throws, so a stuck flush cannot hold a rollover. */
export async function runStandingRulesFlush(
  runtime: OrcaRuntimeService,
  rpc: TmwkRpc,
  sessionId: string
): Promise<FlushOutcome> {
  const state = stateFor(runtime, sessionId)
  if (!state.turnSinceFlush) {
    return 'skipped'
  }
  let stop = (): void => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const completed = new Promise<FlushOutcome>((resolve) => {
    // Subscribe before checking for a running turn so its completion is not missed.
    let sent = false
    stop = onMainTurn(runtime, (event) => {
      if (event.type !== 'completion' || event.pinnedSessionId !== sessionId) {
        return
      }
      if (sent) {
        resolve('done')
      } else {
        sendAfterTurn()
      }
    })
    timer = setTimeout(() => resolve('timeout'), FLUSH_WAIT_MS)
    timer.unref?.()
    const sendAfterTurn = (): void => {
      if (sent) {
        return
      }
      void sendFlush().catch(() => resolve('skipped'))
    }
    const sendFlush = async (): Promise<void> => {
      state.turnSinceFlush = false
      state.absorbFlushCompletion = true
      sent = true
      try {
        await sendMainNotice(rpc, sessionId, FLUSH_NOTICE)
      } catch (error) {
        console.error('[tmwk] flush notice not sent:', error)
        state.turnSinceFlush = true
        throw error
      }
    }
    hasTurnInFlight(runtime, sessionId).then(
      (running) => {
        if (!running) {
          sendAfterTurn()
        }
      },
      () => sendAfterTurn()
    )
  })
  const outcome = await completed
  clearTimeout(timer)
  stop()
  state.absorbFlushCompletion = false
  return outcome
}
