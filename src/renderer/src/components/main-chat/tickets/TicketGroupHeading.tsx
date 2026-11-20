import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { groupItemKey } from './ticket-list-items'

/** A collapsible group's heading with its count, such as Done; Space, Enter or a click toggles it. */
export function TicketGroupHeading({
  groupId,
  label,
  count,
  open,
  focusable,
  onToggle,
  onFocusItem,
  className
}: {
  groupId: string
  label: string
  count: number
  open: boolean
  focusable: boolean
  onToggle: (groupId: string) => void
  onFocusItem: (key: string) => void
  className?: string
}): React.JSX.Element {
  const key = groupItemKey(groupId)
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <div
      role="option"
      aria-selected={false}
      aria-expanded={open}
      data-ticket-item={key}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onToggle(groupId)}
      onFocus={() => onFocusItem(key)}
      className={cn(
        'flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md px-2 text-xs font-medium text-worktree-sidebar-foreground/60 outline-none hover:bg-worktree-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring',
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}
