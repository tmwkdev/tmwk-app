import React from 'react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import type { VirtualizedScrollAnchor } from '@/lib/list-interaction/virtualized-scrolling/useVirtualizedScrollAnchor'
import Sidebar from '@/components/sidebar'
import { ConfirmationDialogProvider } from '@/components/dismiss/confirmation/confirmation-dialog'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import {
  makeRepo,
  makeWorktree
} from '@/components/worktree-jump/worktree-jump-palette-test-fixtures'
import {
  makeFolderWorkspace,
  makeProjectGroup
} from '@/components/sidebar/workspace-creation/folder/folder-workspace-composer-submit-fixtures'

const repo = { ...makeRepo(), displayName: 'tmwk-app' }
const worktrees = ['main', 'chat-dock-compact', 'brand-refresh'].map((name, index) =>
  makeWorktree(`dock-${index}`, name, { branch: name })
)
const projectGroup = makeProjectGroup()
const folder = makeFolderWorkspace({ projectGroupId: projectGroup.id, name: 'Design notes' })

function SidebarFrame({ height = 700 }: { height?: number }): React.JSX.Element {
  const scrollOffset = React.useRef(0)
  const scrollAnchor = React.useRef<VirtualizedScrollAnchor>(null)
  return (
    <ConfirmationDialogProvider>
      <div className="flex" style={{ height }}>
        <Sidebar worktreeScrollOffsetRef={scrollOffset} worktreeScrollAnchorRef={scrollAnchor} />
      </div>
    </ConfirmationDialogProvider>
  )
}

export const chat = defineFixture({
  width: 312,
  store: {
    sidebarOpen: true,
    sidebarWidth: 280,
    startupWorktreeRefreshCompleted: true,
    activeView: 'main',
    activeWorktreeId: worktrees[1].id,
    repos: [repo],
    worktreesByRepo: { [repo.id]: worktrees },
    projectGroups: [projectGroup],
    folderWorkspaces: [folder],
    worktreeCardsIntroNoticeSeen: true,
    worktreeCardsUpdateNoticeSeen: true,
    setupGuideSidebarDismissed: true
  },
  render: () => <SidebarFrame />
})

export const workspace = defineFixture({
  ...chat,
  store: { ...chat.store, activeView: 'terminal' }
})

export const narrow = defineFixture({
  ...workspace,
  width: 252,
  store: { ...workspace.store, sidebarWidth: 220 }
})

export const short = defineFixture({
  ...workspace,
  store: {
    ...workspace.store,
    worktreesByRepo: {
      [repo.id]: Array.from({ length: 24 }, (_, index) =>
        makeWorktree(`dock-${index}`, `workspace-${index + 1}`)
      )
    }
  },
  render: () => <SidebarFrame height={360} />
})

export const folderWorkspace = defineFixture({
  ...workspace,
  store: {
    ...workspace.store,
    activeWorktreeId: folderWorkspaceKey(folder.id),
    activeWorkspaceKey: folderWorkspaceKey(folder.id)
  }
})

export const activity = defineFixture({
  ...chat,
  store: { ...chat.store, activeView: 'activity', sidebarBody: 'agents' }
})

export const collapsed = defineFixture({
  ...chat,
  store: { ...chat.store, sidebarOpen: false }
})
