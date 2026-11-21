import React, { useRef } from 'react'
import WorktreeContextMenu from '@/components/sidebar/workspace-actions/context-menu/WorktreeContextMenu'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { useTicketOwnerWorktree } from './TicketWorktreeCard'

/** Right-click on a ticket row opens Orca's menu for its owner worktree, settled tickets included. */
function TicketRowWorktreeMenu({
  row,
  children
}: {
  row: TicketRowModel
  children: React.ReactNode
}): React.JSX.Element {
  const worktree = useTicketOwnerWorktree(row, { includeSettled: true })
  const rowRef = useRef<HTMLElement | null>(null)
  if (!worktree) {
    return <>{children}</>
  }
  return (
    <WorktreeContextMenu
      worktree={worktree}
      onContextMenuSelect={(event) => {
        rowRef.current = event.currentTarget.querySelector<HTMLElement>('[data-ticket-item]')
        return [worktree]
      }}
      onOpenChange={(open) => {
        if (open) {
          return
        }
        // Orca's close returns focus to its own list; the ticket list isn't one, so refocus the row.
        requestAnimationFrame(() => {
          const focused = document.activeElement
          if (!focused || focused === document.body) {
            rowRef.current?.focus({ preventScroll: true })
          }
        })
      }}
    >
      {children}
    </WorktreeContextMenu>
  )
}

export function wrapTicketRowInWorktreeMenu(
  row: TicketRowModel,
  rowNode: React.ReactNode
): React.ReactNode {
  return <TicketRowWorktreeMenu row={row}>{rowNode}</TicketRowWorktreeMenu>
}
