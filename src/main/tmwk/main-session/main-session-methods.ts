import {
  TmwkMainSessionGetParams,
  TmwkMainSessionRolloverParams,
  TmwkMainSessionSwitchParams
} from '../../../shared/rpc-contract/tmwk/main-session-params'
import { defineMethod } from '../../runtime/rpc/core'
import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import { normalizeDisabledTuiAgents } from '../../../shared/agent-launch/catalog/tui-agent-selection'
import { STRUCTURED_AGENT_RUNTIME_METADATA } from '../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import type {
  MainSessionRolloverResult,
  MainSessionState
} from '../../../shared/tmwk/main-session-switch'
import type { MainSessionRecord } from '../../../shared/tmwk/main-session-record'
import { ensureTmwkMainHome } from '../main-home/ensure-main-home'
import { startTmwkMainHome } from '../main-home/start-main-home'
import { requireTmwkHomeHost } from '../rpc/tmwk-home-host-guard'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { tmwkError } from '../tmwk-error'
import { createTmwkRpc } from './tmwk-runtime-rpc'
import { readMainSessionPin } from './main-session-pin'
import {
  readMainSessionChangeFailure,
  readPendingMainSessionChange
} from './pending-main-session-change'
import {
  queueMainSessionRollover,
  queueMainSessionSwitch,
  refuseWhilePending
} from './queue-main-session-replace'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'

function mainAgents(runtime: OrcaRuntimeService): string[] {
  const disabled = normalizeDisabledTuiAgents(
    runtime.requireStore().getSettings().disabledTuiAgents
  )
  return STRUCTURED_AGENT_RUNTIME_METADATA.map(({ definition }) => definition.agent).filter(
    (agent) => isTuiAgent(agent) && !disabled.includes(agent)
  )
}

async function mainHome(runtime: OrcaRuntimeService) {
  const home = await ensureTmwkMainHome(createTmwkRpc(runtime))
  if (!home) {
    throw new Error('The main chat home could not be prepared.')
  }
  return home
}

async function requirePinnedSession(
  runtime: OrcaRuntimeService,
  requestedAgent: string | undefined,
  expectedSessionId: string | undefined
): Promise<{ current: MainSessionRecord; agent: string; agents: string[] }> {
  const agents = mainAgents(runtime)
  const current = await readMainSessionPin(resolveMainHomePaths().sessionRecord)
  if (!current) {
    throw tmwkError('main_chat_not_started', 'The main chat has not started yet.')
  }
  if (expectedSessionId !== undefined && current.sessionId !== expectedSessionId) {
    throw tmwkError('session_changed', 'The main chat changed. Reload it and try again.')
  }
  const agent = requestedAgent ?? current.agent
  if (!agents.includes(agent)) {
    throw new Error('Choose an enabled structured-chat agent.')
  }
  return { current, agent, agents }
}

export const TMWK_MAIN_SESSION_METHODS = [
  defineMethod({
    name: 'tmwk.mainSession.get',
    permission: 'workspace',
    params: TmwkMainSessionGetParams,
    // Reads the pin directly: a queued replace must not hold the view's refetch.
    handler: async (_params, { runtime }): Promise<MainSessionState> => {
      requireTmwkHomeHost()
      await startTmwkMainHome(runtime)
      return {
        pin: await readMainSessionPin(resolveMainHomePaths().sessionRecord),
        agents: mainAgents(runtime),
        pending: readPendingMainSessionChange(runtime),
        lastFailure: readMainSessionChangeFailure(runtime)
      }
    }
  }),
  defineMethod({
    name: 'tmwk.mainSession.switch',
    permission: 'workspace',
    params: TmwkMainSessionSwitchParams,
    handler: async (params, { runtime }): Promise<MainSessionState> => {
      requireTmwkHomeHost()
      await startTmwkMainHome(runtime)
      const { current, agents } = await requirePinnedSession(
        runtime,
        params.agent,
        params.expectedSessionId
      )
      if (current.agent === params.agent) {
        return { pin: current, agents, pending: readPendingMainSessionChange(runtime) }
      }
      const home = await mainHome(runtime)
      refuseWhilePending(runtime)
      queueMainSessionSwitch({
        runtime,
        home,
        sessionId: current.sessionId,
        agent: params.agent
      })
      return {
        pin: current,
        agents,
        pending: { kind: 'switch', agent: params.agent, phase: 'saving' }
      }
    }
  }),
  defineMethod({
    name: 'tmwk.mainSession.rollover',
    permission: 'workspace',
    params: TmwkMainSessionRolloverParams,
    handler: async (params, { runtime }): Promise<MainSessionRolloverResult> => {
      requireTmwkHomeHost()
      await startTmwkMainHome(runtime)
      const { current, agent } = await requirePinnedSession(
        runtime,
        params.agent,
        params.expectedSessionId
      )
      const home = await mainHome(runtime)
      refuseWhilePending(runtime)
      return queueMainSessionRollover({ runtime, home, sessionId: current.sessionId, agent })
    }
  })
]
