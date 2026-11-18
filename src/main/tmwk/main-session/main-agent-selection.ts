import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import { normalizeDisabledTuiAgents } from '../../../shared/agent-launch/catalog/tui-agent-selection'
import { resolveWorktreeStartupDraftAgent } from '../../runtime/workspaces/startup/runtime-worktree-agent-startup'
import { structuredAgentRuntimeMetadata } from '../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'

// Claude and Codex read the prompt from files in the main home; every other chat agent gets it as its first turn.
const FILE_PROMPT_AGENTS: ReadonlySet<string> = new Set(['claude', 'codex'])

export function needsFirstTurnPrompt(agent: string): boolean {
  return !FILE_PROMPT_AGENTS.has(agent)
}

/** Orca's new-workspace agent resolution, skipping agents with no structured chat adapter. */
export async function pickMainAgent(
  runtime: OrcaRuntimeService,
  mainHomePath: string
): Promise<string | null> {
  const settings = runtime.requireStore().getSettings()
  const disabled = normalizeDisabledTuiAgents(settings.disabledTuiAgents)
  for (let attempt = 0; attempt < 64; attempt++) {
    const agent = await resolveWorktreeStartupDraftAgent({
      repo: { path: mainHomePath },
      // A 'blank' default means no agent, but the main chat needs one.
      settings: {
        ...settings,
        defaultTuiAgent: settings.defaultTuiAgent === 'blank' ? null : settings.defaultTuiAgent,
        disabledTuiAgents: disabled
      }
    })
    if (agent === null || !isTuiAgent(agent)) {
      return null
    }
    if (structuredAgentRuntimeMetadata(agent)) {
      return agent
    }
    disabled.push(agent)
  }
  return null
}
