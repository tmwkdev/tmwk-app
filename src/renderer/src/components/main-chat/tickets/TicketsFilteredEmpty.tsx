import React from 'react'

/** In place of the sections when filters leave nothing (D63): the message and the way back. */
export function TicketsFilteredEmpty({
  message,
  action,
  onAction
}: {
  message: string
  action: string
  onAction: () => void
}): React.JSX.Element {
  return (
    <div role="status" className="px-2 py-3 text-xs leading-5 text-muted-foreground">
      {message}
      {' · '}
      <button
        type="button"
        onClick={onAction}
        className="rounded-sm font-medium text-worktree-sidebar-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
      >
        {action}
      </button>
    </div>
  )
}
