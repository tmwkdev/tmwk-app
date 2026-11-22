// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfirmationDialogProvider } from '@/components/dismiss/confirmation/confirmation-dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { TEST_REPO } from '@/store/repos/repo.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { DEFAULT_TICKET_OPTIONS } from './ticket-options-store'
import { LAPTOP, noop, session, ticket } from './ticket-sidebar-seeds.test-fixture'
import { wrapTicketRowInWorktreeMenu } from './TicketRowWorktreeMenu'
import { TicketsSidebar } from './TicketsSidebar'

afterEach(() => {
  cleanup()
  useAppStore.setState(useAppStore.getInitialState(), true)
})

function renderOwnedTicket(id: string, title: string, state: TicketRowModel['state']): void {
  const row = ticket(id, title, 'orca', state, null, LAPTOP, 1, {
    sessions: [{ ...session(`${id}-owner`, 'claude', 'done'), worktreeId: `orca::/repo/${id}` }]
  })
  useAppStore.setState({
    repos: [{ ...TEST_REPO, id: 'orca' }],
    worktreesByRepo: {
      orca: [makeWorktree({ id: `orca::/repo/${id}`, repoId: 'orca', path: `/repo/${id}` })]
    }
  })
  render(
    <ConfirmationDialogProvider>
      <TooltipProvider>
        <TicketsSidebar
          rows={[row]}
          selectedId={null}
          onSelect={noop}
          onOpenSession={noop}
          onNewTicket={noop}
          projectFilterLabel={null}
          onHandOffInChat={noop}
          options={DEFAULT_TICKET_OPTIONS}
          wrapRow={wrapTicketRowInWorktreeMenu}
        />
      </TooltipProvider>
    </ConfirmationDialogProvider>
  )
}

const expectWorktreeMenu = (): void => {
  expect(screen.getByRole('menu')).toBeTruthy()
}

describe('ticket row right-click', () => {
  it('opens the owner worktree menu for a working ticket', () => {
    renderOwnedTicket('settings', 'New settings page', 'running')

    fireEvent.contextMenu(screen.getByText('New settings page'))

    expectWorktreeMenu()
  })

  it('opens the owner worktree menu for a done ticket', () => {
    renderOwnedTicket('billing', 'Fix billing export', 'done')
    fireEvent.click(within(screen.getByRole('group', { name: 'Done' })).getByRole('option'))

    fireEvent.contextMenu(screen.getByText('Fix billing export'))

    expectWorktreeMenu()
  })
})
