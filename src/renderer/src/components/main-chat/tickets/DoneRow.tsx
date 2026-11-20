import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { DONE_ITEM_KEY } from './ticket-list-items'

/** Done, collapsed to one row with its count; Space or a click toggles it. */
export function DoneRow({
  count,
  open,
  focusable,
  onToggle,
  onFocusItem
}: {
  count: number
  open: boolean
  focusable: boolean
  onToggle: () => void
  onFocusItem: (key: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <div
      role="option"
      aria-selected={false}
      aria-expanded={open}
      data-ticket-item={DONE_ITEM_KEY}
      tabIndex={focusable ? 0 : -1}
      onClick={onToggle}
      onFocus={() => onFocusItem(DONE_ITEM_KEY)}
      className="mt-1 flex h-7 cursor-default items-center gap-1 rounded-md px-2 text-xs font-medium text-worktree-sidebar-foreground/60 outline-none hover:bg-worktree-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
    >
      <Icon className="size-3" aria-hidden="true" />
      {t('tmwk.tickets.done', 'Done')}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}
