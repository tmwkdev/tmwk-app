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

it('leaves the card the sessions it lists and hangs the rest beneath it', () => {
  const row = ticket('t-1', 'Update the MBP server', 'tmwk-app', 'running', null, MBP, 0, {
    sessions: [
      session('owner', 'claude', 'working'),
      session('child', 'claude', 'working', 'Helper')
    ]
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
        cardSessions={new Map([['t-1', new Set(['owner'])]])}
      />
    </TooltipProvider>
  )
  fireEvent.click(container.querySelector('[data-ticket-disclosure]')!)
  expect(screen.queryByText('Owner')).toBeNull()
  expect(screen.getByText('Helper')).toBeInTheDocument()
})
