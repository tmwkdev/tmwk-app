import { describe, expect, it } from 'vitest'
import { sidebarCurrent } from './ticket-sidebar-store'

describe('sidebarCurrent', () => {
  it('marks only Chat while the main view shows Chat, even with a worktree still active', () => {
    expect(sidebarCurrent('main', null, 'wt-1')).toEqual({ kind: 'chat' })
  })

  it('marks only the worktree once its view is shown, even with a ticket still open', () => {
    expect(sidebarCurrent('terminal', 'ticket-1', 'wt-1')).toEqual({
      kind: 'worktree',
      worktreeId: 'wt-1'
    })
  })
})
