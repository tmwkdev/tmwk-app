import React, { useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { PopoverAnchor } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { OptionsFilterCountBadge } from '@/components/sidebar/worktree-list/controls/options-filter-count-badge'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { withoutHiddenRepos } from '../../../../../shared/project/catalog/hidden-projects'
import { StatusOrderPopover } from './StatusOrderPopover'
import { TicketOptionsMenuItems } from './TicketOptionsMenuItems'
import { activeRowFilterCount, useTicketOptionsStore } from './ticket-options-store'

/** Row filters plus selected projects, counted as Workspace options counts them. */
function useActiveFilterCount(): number {
  const rowFilters = useTicketOptionsStore((s) => activeRowFilterCount(s.options))
  const projects = useAppStore((s) => {
    const selected = new Set(s.filterRepoIds)
    return withoutHiddenRepos(s.repos).filter((repo) => selected.has(repo.id)).length
  })
  return rowFilters + projects
}

/** The Tickets header's options button: Ticket options, and Status order beside it. */
export function TicketOptionsMenu({
  onOpenWorktreeView
}: {
  onOpenWorktreeView?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  // Why: the order popover opens once the menu has closed, so the menu's focus return can't dismiss it.
  const orderPending = useRef(false)
  const count = useActiveFilterCount()
  const label =
    count > 0
      ? t('tmwk.tickets.options.titleActive', 'Ticket options ({{count}} filters active)', {
          count,
          defaultValue_one: 'Ticket options ({{count}} filter active)'
        })
      : t('tmwk.tickets.options.title', 'Ticket options')

  return (
    <StatusOrderPopover open={orderOpen} onOpenChange={setOrderOpen}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <PopoverAnchor asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  className="relative text-muted-foreground"
                  aria-label={label}
                >
                  <SlidersHorizontal className="size-3.5" strokeWidth={2.25} />
                  <OptionsFilterCountBadge count={count} />
                </Button>
              </PopoverAnchor>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {label}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-72 pb-2"
          onCloseAutoFocus={(event) => {
            if (orderPending.current) {
              orderPending.current = false
              event.preventDefault()
              setOrderOpen(true)
            }
          }}
        >
          <TicketOptionsMenuItems
            onOpenStatusOrder={() => {
              orderPending.current = true
            }}
            onOpenWorktreeView={onOpenWorktreeView}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </StatusOrderPopover>
  )
}
