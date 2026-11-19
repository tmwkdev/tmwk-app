import { z } from 'zod'
import { AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE } from '../../../shared/agent-launch/contracts/agent-launch-session-already-exists'
import type { MainHome } from '../main-home/ensure-main-home'
import { needsFirstTurnPrompt } from './main-agent-selection'
import { TmwkRpcError, type TmwkRpc } from './tmwk-runtime-rpc'

/** Launches the structured chat for a session id and checks the runtime accepted it; throws otherwise. */
export async function launchMainSession(
  rpc: TmwkRpc,
  home: MainHome,
  session: { sessionId: string; agent: string }
): Promise<void> {
  const firstTurnPrompt = needsFirstTurnPrompt(session.agent)
  const launched = await rpc('agent.launch', {
    agent: session.agent,
    target: { kind: 'existing', worktree: `id:${home.worktreeId}` },
    surface: 'chat',
    presentation: 'background',
    launchSource: 'tmwk',
    sessionId: session.sessionId,
    ...(firstTurnPrompt ? { prompt: { text: home.prompt, delivery: 'submit' } } : {})
  })
  z.object({
    outcome: z.object({ kind: z.literal('structured'), sessionId: z.literal(session.sessionId) })
  }).parse(launched)
  if (firstTurnPrompt) {
    z.object({ prompt: z.object({ outcome: z.literal('journaled') }) }).parse(launched)
  }
}

export function isSessionAlreadyExists(error: unknown): boolean {
  return (
    error instanceof TmwkRpcError &&
    (error.code === AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE ||
      error.message.includes(AGENT_LAUNCH_SESSION_ALREADY_EXISTS_CODE))
  )
}
