import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { AgentSessionTurnCompletionEvent } from '../../../shared/agent-session/view/agent-session-turn-completion-wire'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { createTmwkRuntimeClient } from '../main-session/tmwk-runtime-rpc'

export type MainTurnEvent = Extract<
  AgentSessionTurnCompletionEvent,
  { type: 'completion' | 'prompt' }
> & {
  /** The pinned session this event belongs to. */
  pinnedSessionId: string
}
export type MainTurnListener = (event: MainTurnEvent) => void

type Observer = {
  listeners: Set<MainTurnListener>
  queue: Promise<void>
  started: boolean
}

const RESUBSCRIBE_DELAY_MS = 5_000

const observers = new WeakMap<OrcaRuntimeService, Observer>()

function observerFor(runtime: OrcaRuntimeService): Observer {
  let observer = observers.get(runtime)
  if (!observer) {
    observer = { listeners: new Set(), queue: Promise.resolve(), started: false }
    observers.set(runtime, observer)
  }
  return observer
}

/** Later steps (rollover, ticket refresh, presence) register here, before or after start; the stream is shared. */
export function onMainTurn(runtime: OrcaRuntimeService, listener: MainTurnListener): () => void {
  const observer = observerFor(runtime)
  observer.listeners.add(listener)
  return () => observer.listeners.delete(listener)
}

/** One subscription per runtime; the pin is re-read per event so a replaced session needs no resubscribe. */
export function startMainSessionTurns(runtime: OrcaRuntimeService, pinPath: string): void {
  const observer = observerFor(runtime)
  if (observer.started) {
    return
  }
  observer.started = true
  subscribe(runtime, observer, pinPath)
}

function subscribe(runtime: OrcaRuntimeService, observer: Observer, pinPath: string): void {
  let resubscribed = false
  let abort = (): void => {}
  const resubscribe = (): void => {
    if (resubscribed) {
      return
    }
    resubscribed = true
    abort()
    console.error('[tmwk] main turn stream ended; resubscribing')
    setTimeout(() => subscribe(runtime, observer, pinPath), RESUBSCRIBE_DELAY_MS).unref?.()
  }
  abort = createTmwkRuntimeClient(runtime).subscribe(
    'agentSession.subscribeTurnCompletions',
    { includePrompts: true },
    (frame) => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: subscribeTurnCompletions only emits AgentSessionTurnCompletionEvent frames.
      const event = frame as AgentSessionTurnCompletionEvent
      if (event.type === 'end') {
        resubscribe()
        return
      }
      observer.queue = observer.queue.then(() => handleFrame(observer, pinPath, event))
    },
    resubscribe
  )
}

async function handleFrame(
  observer: Observer,
  pinPath: string,
  event: AgentSessionTurnCompletionEvent
): Promise<void> {
  try {
    if (event.type === 'end') {
      return
    }
    const sessionId =
      event.type === 'completion' ? event.completion.sessionId : event.prompt.sessionId
    const pin = await readMainSessionPin(pinPath)
    if (pin?.sessionId !== sessionId) {
      return
    }
    if (event.type === 'completion') {
      console.error(
        `[tmwk] main turn completed session=${sessionId} turn=${event.completion.turnId} outcome=${event.completion.outcome}`
      )
    }
    for (const listener of observer.listeners) {
      try {
        listener({ ...event, pinnedSessionId: sessionId })
      } catch (error) {
        console.error('[tmwk] main turn listener failed:', error)
      }
    }
  } catch (error) {
    console.error('[tmwk] main turn event dropped:', error)
  }
}
