import React, { useMemo } from 'react'
import { ListFilter } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SidebarProjectFilterPanel } from '@/components/sidebar/worktree-list/controls/SidebarProjectFilterPanel'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { withoutHiddenRepos } from '../../../../../shared/project/catalog/hidden-projects'

/** The Tickets header's project filter: Orca's `filterRepoIds`, shared with the Worktree view (D62). */
export function ProjectFilterChip({ label }: { label: string | null }): React.JSX.Element {
  const t = useTranslate()
  const allRepos = useAppStore((s) => s.repos)
  const filterRepoIds = useAppStore((s) => s.filterRepoIds)
  const setFilterRepoIds = useAppStore((s) => s.setFilterRepoIds)
  const repos = useMemo(() => withoutHiddenRepos(allRepos), [allRepos])
  const selected = useMemo(() => new Set(filterRepoIds), [filterRepoIds])
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('tmwk.tickets.projectFilter', 'Project filter')}
          className="flex h-6 min-w-0 items-center gap-1 rounded-md px-1 text-2xs text-muted-foreground outline-none hover:bg-worktree-sidebar-accent hover:text-worktree-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
        >
          <ListFilter className="size-3 shrink-0" />
          <span className="truncate">{label ?? t('tmwk.tickets.allProjects', 'All projects')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64">
        <SidebarProjectFilterPanel
          availableRepos={repos.filter((repo) => !selected.has(repo.id))}
          selectedRepos={repos.filter((repo) => selected.has(repo.id))}
          hasRepoFilter={repos.some((repo) => selected.has(repo.id))}
          filterRepoIds={filterRepoIds}
          setFilterRepoIds={setFilterRepoIds}
        />
      </PopoverContent>
    </Popover>
  )
}
