import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteInParallel: vi.fn().mockResolvedValue([]),
  state: {
    settings: { skipDeleteWorktreeConfirm: true },
    worktreeLineageById: {},
    worktreesByRepo: {},
    target: {
      id: 'wt-1',
      repoId: 'repo-1',
      displayName: 'feature',
      path: '/repo/wt-1',
      isMainWorktree: false
    },
    clearWorktreeDeleteState: vi.fn(),
    openModal: vi.fn()
  }
}))

vi.mock('@/store/index', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/store/slices/worktrees/listing/worktree-catalog-index', () => ({
  getIndexedAllWorktrees: () => []
}))
vi.mock('@/store/workspaces/selection/worktree-on-host-selector', () => ({
  getWorktreeOnHostFromState: () => mocks.state.target
}))
vi.mock('@/components/editor/save/flush/removal-unsaved-editor-files', () => ({
  collectRemovalUnsavedFiles: () => []
}))
vi.mock('@/components/sidebar/workspace-actions/deletion/worktree-delete-execution', () => ({
  runWorktreeDeletesInParallel: mocks.deleteInParallel
}))
vi.mock('./read-tmwk-delete-worktree-risks', () => ({
  isTmwkDeleteRiskFree: async () => false
}))

import { runWorktreeBatchDelete } from '@/components/sidebar/workspace-actions/deletion/delete-worktree-flow'

describe('"Always delete" with the tmwk risk check', () => {
  it('opens the dialog, with skipping off, for a worktree with work at risk', async () => {
    runWorktreeBatchDelete(['wt-1'])
    await vi.waitFor(() => expect(mocks.state.openModal).toHaveBeenCalled())
    expect(mocks.state.openModal).toHaveBeenCalledWith(
      'delete-worktree',
      expect.objectContaining({ worktreeId: 'wt-1', allowSkipConfirm: false })
    )
    expect(mocks.deleteInParallel).not.toHaveBeenCalled()
  })
})
