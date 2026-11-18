import { tmwkError } from '../tmwk-error'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'

export type RepoLookup = (selector: string) => Promise<{ id: string; displayName: string }>

// Resolves like `orca repo show --repo`, so folder workspaces work and a worktree never scopes a record.
export async function resolveTmwkProject(
  lookup: RepoLookup,
  selector: string | undefined
): Promise<NonNullable<TmwkRecord['project']> | null> {
  if (selector === undefined) {
    return null
  }
  try {
    const repo = await lookup(selector)
    return { repoId: repo.id, name: repo.displayName }
  } catch (error) {
    throw tmwkError(
      'unknown_project',
      `no project matches "${selector}": ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
