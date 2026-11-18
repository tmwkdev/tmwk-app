import { z } from 'zod'
import type { MainSessionEndReason } from '../../../shared/tmwk/main-session-record'
import type { MainSessionRolloverResult } from '../../../shared/tmwk/main-session-switch'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { tmwkError } from '../tmwk-error'
import { onMainTurn } from '../rollover/main-session-turns'
import {
  clearPendingMainSessionChange,
  markPendingMainSessionChange,
  readPendingMainSessionChange,
  recordMainSessionChangeFailure
} from './pending-main-session-change'
import { runMainSessionOperation } from './main-session-operations'
import { replaceMainSession } from './replace-main-session'
import { readMainSessionPin } from './main-session-pin'
import { createTmwkRpc } from './tmwk-runtime-rpc'
import type { MainHome } from '../main-home/ensure-main-home'

export function refuseWhilePending(runtime: OrcaRuntimeService): void {
  if (readPendingMainSessionChange(runtime)) {
    throw tmwkError('rollover_busy', 'A main chat change is already in progress.')
  }
}

type QueueInput = {
  runtime: OrcaRuntimeService
  home: MainHome
  sessionId: string
  agent: string
  reason: MainSessionEndReason
}

/** Runs the replace after earlier main-session work; the caller has already marked the change pending. */
function queueReplace({ runtime, home, sessionId, agent, reason }: QueueInput): void {
  void runMainSessionOperation(runtime, async () => {
    const current = await readMainSessionPin(home.paths.sessionRecord)
    if (current?.sessionId !== sessionId) {
      throw tmwkError('session_changed', 'The main chat changed before the new session started.')
    }
    await replaceMainSession({ rpc: createTmwkRpc(runtime), home, current, agent, reason })
  })
    .catch((error: unknown) => {
      console.error(`[tmwk] main session ${reason} failed:`, error)
      recordMainSessionChangeFailure(runtime, 'Cannot switch agents.')
    })
    .finally(() => clearPendingMainSessionChange(runtime))
}

export function queueMainSessionSwitch(input: Omit<QueueInput, 'reason'>): void {
  markPendingMainSessionChange(input.runtime, { kind: 'switch', agent: input.agent })
  queueReplace({ ...input, reason: 'switch' })
}

const SCHEDULED_ROLLOVER_TIMEOUT_MS = 10 * 60 * 1000

const HistoryTurn = z.object({
  page: z.object({
    latestTurn: z.object({ turn: z.object({ state: z.string() }) }).nullish()
  })
})

async function hasTurnInFlight(runtime: OrcaRuntimeService, sessionId: string): Promise<boolean> {
  const history = await createTmwkRpc(runtime)('agentSession.history', {
    sessionId,
    direction: 'tail',
    limit: 1
  }).catch(() => null)
  const parsed = HistoryTurn.safeParse(history)
  return parsed.success && parsed.data.page.latestTurn?.turn.state === 'running'
}

/** Waits for the pinned session's current turn to end, so a partner calling it from inside its own turn does not deadlock. */
export async function queueMainSessionRollover(
  input: Omit<QueueInput, 'reason'>
): Promise<MainSessionRolloverResult> {
  const { runtime, sessionId, agent } = input
  markPendingMainSessionChange(runtime, { kind: 'rollover', agent })
  let stop = (): void => {}
  let finished = false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Listen before reading the status so a turn ending in between is not missed.
    stop = onMainTurn(runtime, (event) => {
      if (event.type === 'completion' && event.pinnedSessionId === sessionId && !finished) {
        finished = true
        clearTimeout(timer)
        stop()
        queueReplace({ ...input, reason: 'rollover' })
      }
    })
    if (await hasTurnInFlight(runtime, sessionId)) {
      if (!finished) {
        // A turn that never completes must not leave the change pending forever.
        timer = setTimeout(() => {
          finished = true
          stop()
          clearPendingMainSessionChange(runtime)
          recordMainSessionChangeFailure(runtime, 'The chat did not finish its turn in time.')
        }, SCHEDULED_ROLLOVER_TIMEOUT_MS)
        timer.unref?.()
      }
      return { state: 'scheduled', sessionId }
    }
    if (!finished) {
      finished = true
      stop()
      queueReplace({ ...input, reason: 'rollover' })
    }
    return { state: 'running', sessionId }
  } catch (error) {
    clearTimeout(timer)
    stop()
    if (!finished) {
      clearPendingMainSessionChange(runtime)
    }
    throw error
  }
}
