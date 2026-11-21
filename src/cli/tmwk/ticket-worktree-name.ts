import { slugifyForWorkspaceName } from '../../shared/workspace/naming/workspace-name'

/** A new worktree's name, and so its branch: the partner's `--name`, else the ticket title, never a random word. */
export function ticketWorktreeName(
  named: string | undefined,
  worktree: string,
  title: string
): string | undefined {
  // Orca refuses a name for a placement it does not create, such as a folder or a retry's worktree.
  if (!worktree.startsWith('new-')) {
    return undefined
  }
  return named || slugifyForWorkspaceName(title) || undefined
}
