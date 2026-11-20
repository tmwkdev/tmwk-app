import React, { useLayoutEffect, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { isMacUserAgent } from '@/app-shell/platform/user-agent-platform'
import type { TicketState } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import {
  DEFAULT_TICKET_STATUS_ORDER,
  type TicketStatus
} from '../../../../../shared/tmwk/ticket-overview/ticket-status'
import { TicketStateGlyph } from './ticket-glyphs'
import { useTicketOptionsStore } from './ticket-options-store'
import { useTicketStatusLabels } from './ticket-status-labels'

const STATE_OF_STATUS: Record<TicketStatus, TicketState> = {
  needsDecision: 'decision',
  blocked: 'stop',
  readyForReview: 'result',
  running: 'running',
  waiting: 'waiting',
  paused: 'paused',
  done: 'done'
}

export function isDefaultStatusOrder(order: readonly TicketStatus[]): boolean {
  return order.every((status, index) => status === DEFAULT_TICKET_STATUS_ORDER[index])
}

function StatusOrderRow({
  status,
  index,
  count,
  onMove
}: {
  status: TicketStatus
  index: number
  count: number
  onMove: (status: TicketStatus, delta: number) => void
}): React.JSX.Element {
  const t = useTranslate()
  const label = useTicketStatusLabels()[status]
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id: status })
  const moveHint = isMacUserAgent() ? '⌥↑↓' : 'Alt+↑↓'
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      tabIndex={0}
      data-status-order-item={status}
      aria-label={t('tmwk.tickets.statusOrderRow', '{{status}}, {{position}} of {{count}}', {
        status: label,
        position: index + 1,
        count
      })}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onKeyDown={(event) => {
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault()
          onMove(status, event.key === 'ArrowDown' ? 1 : -1)
        }
      }}
      className={cn(
        'group/status flex h-7 items-center gap-2 rounded-[5px] px-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isDragging && 'relative z-10 border border-border bg-popover shadow-md'
      )}
    >
      <span
        ref={setActivatorNodeRef}
        {...listeners}
        aria-hidden="true"
        className="flex h-5 w-4 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3" />
      </span>
      <TicketStateGlyph state={STATE_OF_STATUS[status]} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="hidden pr-1 text-2xs text-muted-foreground group-focus-visible/status:inline">
        {moveHint}
      </span>
    </div>
  )
}

/** Group by Status's own order: a stable list, never a cascading submenu, so drags and ⌥↑↓ stay put. */
export function StatusOrderPanel({
  order,
  onChange,
  onReset
}: {
  order: readonly TicketStatus[]
  onChange: (order: TicketStatus[]) => void
  onReset: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const listRef = useRef<HTMLDivElement>(null)
  // Why: reordering moves the focused row's DOM node, which drops focus; restore it after commit.
  const focusAfterMove = useRef<TicketStatus | null>(null)
  useLayoutEffect(() => {
    const status = focusAfterMove.current
    focusAfterMove.current = null
    if (status) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-status-order-item="${status}"]`)
        ?.focus({ preventScroll: true })
    }
  }, [order])

  const move = (status: TicketStatus, delta: number): void => {
    const from = order.indexOf(status)
    const to = from + delta
    if (from === -1 || to < 0 || to >= order.length) {
      return
    }
    focusAfterMove.current = status
    onChange(arrayMove([...order], from, to))
  }
  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    if (over && active.id !== over.id) {
      onChange(
        arrayMove(
          [...order],
          order.indexOf(active.id as TicketStatus),
          order.indexOf(over.id as TicketStatus)
        )
      )
    }
  }

  return (
    <div className="text-popover-foreground">
      <div className="px-2 pt-1 text-sm font-medium">
        {t('tmwk.tickets.statusOrder', 'Status order')}
      </div>
      <div className="flex items-start gap-1.5 px-2 pt-1 pb-2 text-2xs leading-4 text-muted-foreground">
        <Pin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t(
          'tmwk.tickets.statusOrderNote',
          'The Needs you count stays above every section, and decisions still reach you in Chat.'
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
          <div ref={listRef} role="list" className="flex flex-col px-1">
            {order.map((status, index) => (
              <StatusOrderRow
                key={status}
                status={status}
                index={index}
                count={order.length}
                onMove={move}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-1 flex items-center border-t border-border px-1 pt-1.5">
        <span className="flex-1 px-1 text-2xs text-muted-foreground">
          {t('tmwk.tickets.savedForYou', 'Saved for you')}
        </span>
        <Button size="xs" variant="ghost" disabled={isDefaultStatusOrder(order)} onClick={onReset}>
          {t('tmwk.tickets.resetToDefault', 'Reset to default')}
        </Button>
      </div>
    </div>
  )
}

/** The saved status order in a popover; `children` holds its `PopoverAnchor`. */
export function StatusOrderPopover({
  open,
  onOpenChange,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  const order = useTicketOptionsStore((s) => s.options.statusOrder)
  const setOptions = useTicketOptionsStore((s) => s.setOptions)
  const resetStatusOrder = useTicketOptionsStore((s) => s.resetStatusOrder)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children}
      <PopoverContent side="right" align="start" sideOffset={8} className="w-64 p-1">
        <StatusOrderPanel
          order={order}
          onChange={(statusOrder) => setOptions({ statusOrder })}
          onReset={resetStatusOrder}
        />
      </PopoverContent>
    </Popover>
  )
}
