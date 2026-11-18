import { randomUUID } from 'node:crypto'
import { createOrcaSessionId } from '../../../shared/agent-session/identity/orca-session-address'
import {
  MAIN_SESSION_PREVIOUS_CAP,
  type MainSessionEndReason,
  type MainSessionRecord
} from '../../../shared/tmwk/main-session-record'
import type { MainHome } from '../main-home/ensure-main-home'
import { briefMainSession } from './brief-main-session'
import { launchMainSession } from './launch-main-session'
import { writeMainSessionPin } from './main-session-pin'
import { closeStrayMainSessions } from './stray-session-reconciler'
import type { TmwkRpc } from './tmwk-runtime-rpc'

export type ReplaceMainSessionInput = {
  rpc: TmwkRpc
  home: MainHome
  current: MainSessionRecord
  agent: string
  reason: MainSessionEndReason
}

/** The one path that starts a new main session: launch, pin, close the old chat, brief the new one. Throws, with the old pin intact, when the launch fails. */
export async function replaceMainSession(
  input: ReplaceMainSessionInput
): Promise<MainSessionRecord> {
  const { rpc, home, current, agent, reason } = input
  const pinPath = home.paths.sessionRecord
  const now = new Date().toISOString()
  const next = { sessionId: createOrcaSessionId(randomUUID), agent }
  try {
    await launchMainSession(rpc, home, next)
  } catch (error) {
    console.error('[tmwk] replacement main session not created:', error)
    throw new Error('The new main chat could not be started. Your previous chat is still pinned.')
  }
  const pin: MainSessionRecord = {
    ...next,
    createdAt: now,
    previous: [
      {
        sessionId: current.sessionId,
        agent: current.agent,
        createdAt: current.createdAt,
        endedAt: now,
        reason
      },
      ...(current.previous ?? [])
    ].slice(0, MAIN_SESSION_PREVIOUS_CAP),
    briefedAt: null
  }
  writeMainSessionPin(pinPath, pin)
  await closeStrayMainSessions(rpc, home.worktreeId, pin.sessionId).catch((error: unknown) =>
    console.error('[tmwk] stray main-home sessions not reconciled:', error)
  )
  try {
    return await briefMainSession(rpc, pinPath, pin)
  } catch (error) {
    console.error('[tmwk] session briefing not sent; bootstrap will retry:', error)
    return pin
  }
}
