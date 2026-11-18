import { randomUUID } from 'node:crypto'
import { createOrcaSessionId } from '../../../shared/agent-session/identity/orca-session-address'
import type { MainSessionRecord } from '../../../shared/tmwk/main-session-record'
import type { MainHome } from '../main-home/ensure-main-home'
import { briefMainSession } from './brief-main-session'
import { isSessionAlreadyExists, launchMainSession } from './launch-main-session'
import { readMainSessionPin, writeMainSessionPin } from './main-session-pin'
import { closeStrayMainSessions } from './stray-session-reconciler'
import type { TmwkRpc } from './tmwk-runtime-rpc'

export type EnsureMainSessionDeps = {
  rpc: TmwkRpc
  home: MainHome
  pickAgent: () => Promise<string | null>
}

export async function ensureMainSession(
  deps: EnsureMainSessionDeps
): Promise<MainSessionRecord | null> {
  const { rpc, home } = deps
  const pinPath = home.paths.sessionRecord
  let pin = await readMainSessionPin(pinPath)
  const isNew = pin === null
  if (pin === null) {
    const agent = await deps.pickAgent()
    if (agent === null) {
      console.error('[tmwk] no agent available for the main session')
      return null
    }
    pin = {
      sessionId: createOrcaSessionId(randomUUID),
      agent,
      createdAt: new Date().toISOString()
    }
  }
  try {
    await launchMainSession(rpc, home, pin)
  } catch (error) {
    // The pinned id already names a live session: nothing to create.
    if (!isSessionAlreadyExists(error)) {
      console.error('[tmwk] main session not created:', error)
      return null
    }
  }
  if (isNew) {
    writeMainSessionPin(pinPath, pin)
  }
  await closeStrayMainSessions(rpc, home.worktreeId, pin.sessionId).catch((error: unknown) =>
    console.error('[tmwk] stray main-home sessions not reconciled:', error)
  )
  if (pin.previous && pin.previous.length > 0 && !pin.briefedAt) {
    pin = await briefMainSession(rpc, pinPath, pin).catch((error: unknown) => {
      console.error('[tmwk] session briefing not sent:', error)
      return pin
    })
  }
  return pin
}
