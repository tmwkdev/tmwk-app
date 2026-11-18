import { FolderOpen } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useActiveWorktree } from '@/store/workspaces/selection/use-selected-worktree'
import { useActiveRepo } from '@/store/repos/use-repository-catalog'

export function ProjectWorkspaceHeading(): React.JSX.Element | null {
  const t = useTranslate()
  const workspace = useActiveWorktree()
  const project = useActiveRepo()
  if (!workspace) {
    return null
  }
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {t('tmwk.mainChat.projectWorkspace', 'Project workspace')}
        </p>
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {project && project.displayName !== workspace.displayName ? (
            <>
              <span className="max-w-1/3 truncate">{project.displayName}</span>
              <span className="shrink-0 text-muted-foreground">{' / '}</span>
            </>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{workspace.displayName}</span>
        </h1>
      </div>
    </header>
  )
}
