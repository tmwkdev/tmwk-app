import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createOrcaSessionId } from '../../../shared/agent-session/identity/orca-session-address'
import { AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE } from '../../../shared/agent-launch/contracts/agent-launch-session-already-exists'
import type { MainSessionRecord } from '../../../shared/tmwk/main-session-record'
import type { MainHome } from '../main-home/ensure-main-home'
import { needsFirstTurnPrompt } from './main-agent-selection'
import { readMainSessionPin, writeMainSessionPin } from './main-session-pin'
import { closeStrayMainSessions } from './stray-session-reconciler'
import { TmwkRpcError, type TmwkRpc } from './tmwk-runtime-rpc'

export type EnsureMainSessionDeps = {
  rpc: TmwkRpc
  home: MainHome
  pickAgent: () => Promise<string | null>
  replaceWithAgent?: string
}

export async function ensureMainSession(
  deps: EnsureMainSessionDeps
): Promise<MainSessionRecord | null> {
  const { rpc, home } = deps
  const pinPath = home.paths.sessionRecord
  let pin = deps.replaceWithAgent ? null : await readMainSessionPin(pinPath)
  const isNew = pin === null
  if (pin === null) {
    const agent = deps.replaceWithAgent ?? (await deps.pickAgent())
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
    const launched = await rpc('agent.launch', {
      agent: pin.agent,
      target: { kind: 'existing', worktree: `id:${home.worktreeId}` },
      surface: 'chat',
      presentation: 'background',
      launchSource: 'tmwk',
      sessionId: pin.sessionId,
      ...(needsFirstTurnPrompt(pin.agent)
        ? { prompt: { text: home.prompt, delivery: 'submit' } }
        : {})
    })
    z.object({
      outcome: z.object({ kind: z.literal('structured'), sessionId: z.literal(pin.sessionId) })
    }).parse(launched)
    if (needsFirstTurnPrompt(pin.agent)) {
      z.object({ prompt: z.object({ outcome: z.literal('journaled') }) }).parse(launched)
    }
  } catch (error) {
    // The pinned id already names a live session: nothing to create.
    if (!(error instanceof TmwkRpcError && isSessionExists(error))) {
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
  return pin
}

function isSessionExists(error: TmwkRpcError): boolean {
  return (
    error.code === AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE ||
    error.message.includes(AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE)
  )
}
