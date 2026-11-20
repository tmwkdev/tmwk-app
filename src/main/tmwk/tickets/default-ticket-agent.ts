import { resolveWorktreeStartupDraftAgent } from '../../runtime/workspaces/startup/runtime-worktree-agent-startup'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { resolveMainHomePaths } from '../main-home/main-home-paths'

/**
 * Orca's new-workspace default agent for the ticket's project: `worker-start` refuses to create
 * a terminal without one, so a request that names no agent still starts an owner.
 */
export async function defaultTicketAgent(
  runtime: OrcaRuntimeService,
  projectId: string | undefined
): Promise<string | undefined> {
  const repo = projectId ? await runtime.showRepo(projectId).catch(() => null) : null
  const agent = await resolveWorktreeStartupDraftAgent({
    repo: repo ?? { path: resolveMainHomePaths().mainHome },
    settings: runtime.requireStore().getSettings()
  })
  return agent ?? undefined
}
