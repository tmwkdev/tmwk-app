// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TicketsSidebar } from './TicketsSidebar'
import { MBP, session, ticket } from './ticket-sidebar-seeds.test-fixture'

afterEach(cleanup)

it('shows and hides the worktree card with the row chevron', () => {
  const row = ticket('t-1', 'Update the MBP server', 'tmwk-app', 'running', null, MBP, 0)
  const { container } = render(
    <TooltipProvider>
      <TicketsSidebar
        rows={[row]}
        selectedId={null}
        onSelect={() => {}}
        onOpenSession={() => {}}
        onNewTicket={() => {}}
        projectFilterLabel={null}
        onHandOffInChat={() => {}}
        renderWorktree={() => <div data-testid="worktree-card" />}
      />
    </TooltipProvider>
  )
  const chevron = container.querySelector('[data-ticket-disclosure]')
  expect(chevron).not.toBeNull()
  expect(screen.queryByTestId('worktree-card')).toBeNull()

  fireEvent.click(chevron!)
  expect(screen.getByTestId('worktree-card')).toBeInTheDocument()

  fireEvent.click(chevron!)
  expect(screen.queryByTestId('worktree-card')).toBeNull()
})

function renderOpenTicket(withCard: boolean) {
  const owner = { ...session('owner', 'claude', 'working'), worktreeId: 'wt-main' }
  const sameWorktree = {
    ...session('pane', 'claude', 'working', 'Pane helper'),
    worktreeId: 'wt-main'
  }
  const child = { ...session('child', 'claude', 'working', 'Child helper'), worktreeId: 'wt-child' }
  const row = ticket('t-1', 'Update the MBP server', 'tmwk-app', 'running', null, MBP, 0, {
    sessions: [owner, sameWorktree, child]
  })
  const { container } = render(
    <TooltipProvider>
      <TicketsSidebar
        rows={[row]}
        selectedId={null}
        onSelect={() => {}}
        onOpenSession={() => {}}
        onNewTicket={() => {}}
        projectFilterLabel={null}
        onHandOffInChat={() => {}}
        cardOwners={withCard ? new Map([['t-1', owner]]) : undefined}
      />
    </TooltipProvider>
  )
  fireEvent.click(container.querySelector('[data-ticket-disclosure]')!)
  return container
}

it('leaves the card its own worktree sessions and lists sub-agents that broke off beneath it', () => {
  const container = renderOpenTicket(true)
  expect(screen.queryByText('Owner')).toBeNull()
  expect(screen.queryByText('Pane helper')).toBeNull()
  expect(screen.getByText('Child helper')).toBeInTheDocument()
  expect(container.querySelector('[data-ticket-sessions="branched"]')).not.toBeNull()
})

it('keeps the Owner row when no worktree card holds it', () => {
  renderOpenTicket(false)
  expect(screen.getByText('Owner')).toBeInTheDocument()
  expect(screen.getByText('Pane helper')).toBeInTheDocument()
  expect(screen.getByText('Child helper')).toBeInTheDocument()
})
