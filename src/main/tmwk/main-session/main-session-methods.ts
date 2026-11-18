import {
  TmwkMainSessionGetParams,
  TmwkMainSessionSwitchParams
} from '../../../shared/rpc-contract/tmwk/main-session-params'
import { defineMethod } from '../../runtime/rpc/core'
import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import { normalizeDisabledTuiAgents } from '../../../shared/agent-launch/catalog/tui-agent-selection'
import { STRUCTURED_AGENT_RUNTIME_METADATA } from '../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import type { MainSessionState } from '../../../shared/tmwk/main-session-switch'
import { ensureTmwkMainHome } from '../main-home/ensure-main-home'
import { isTmwkHomeHost } from '../main-home/home-host'
import { startTmwkMainHome } from '../main-home/start-main-home'
import { createTmwkRpc } from './tmwk-runtime-rpc'
import { readMainSessionPin } from './main-session-pin'
import { ensureMainSession } from './ensure-main-session'
import { runMainSessionOperation } from './main-session-operations'
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
  if (!isTmwkHomeHost()) {
    throw new Error('This host does not own the main chat.')
  }
  const rpc = createTmwkRpc(runtime)
  const home = await ensureTmwkMainHome(rpc)
  if (!home) {
    throw new Error('The main chat home could not be prepared.')
  }
  return { rpc, home }
}

export const TMWK_MAIN_SESSION_METHODS = [
  defineMethod({
    name: 'tmwk.mainSession.get',
    permission: 'workspace',
    params: TmwkMainSessionGetParams,
    handler: async (_params, { runtime }): Promise<MainSessionState> => {
      await startTmwkMainHome(runtime)
      return runMainSessionOperation(runtime, async () => {
        const { home } = await mainHome(runtime)
        return {
          pin: await readMainSessionPin(home.paths.sessionRecord),
          agents: mainAgents(runtime)
        }
      })
    }
  }),
  defineMethod({
    name: 'tmwk.mainSession.switch',
    permission: 'workspace',
    params: TmwkMainSessionSwitchParams,
    handler: async (params, { runtime }): Promise<MainSessionState> => {
      await startTmwkMainHome(runtime)
      return runMainSessionOperation(runtime, async () => {
        const agents = mainAgents(runtime)
        if (!agents.includes(params.agent)) {
          throw new Error('Choose an enabled structured-chat agent.')
        }
        const { rpc, home } = await mainHome(runtime)
        const current = await readMainSessionPin(home.paths.sessionRecord)
        if (current?.sessionId !== params.expectedSessionId) {
          throw new Error('The main chat changed. Reload it before switching agents.')
        }
        if (current.agent === params.agent) {
          return { pin: current, agents }
        }
        const pin = await ensureMainSession({
          rpc,
          home,
          pickAgent: async () => params.agent,
          replaceWithAgent: params.agent
        })
        if (!pin) {
          throw new Error(
            'The new main chat could not be started. Your previous chat is still pinned.'
          )
        }
        return { pin, agents }
      })
    }
  })
]
