import React from 'react'
import { Check, Copy, MessageCircle, MoreHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { formatPaletteSessionAge } from '@/components/cmd-j/palette-session-age'
import { useNow } from '@/lib/window-activity/use-now'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { statusOf } from '../../../../../shared/tmwk/ticket-overview/ticket-status'
import { TicketStateGlyph } from '../tickets/ticket-glyphs'
import { useTicketStatusLabels } from '../tickets/ticket-status-labels'

export type TicketHeaderActions = {
  /** Shown for a result not yet accepted. */
  onAccept?: () => void
  /** Shown while an attempt is open (D67: no Pause, Orca has no pause primitive). */
  onStop?: () => void
  onOpenInChat: () => void
  onCopyId: () => void
  /** A header action is in flight. */
  busy?: boolean
}

/** Title, state, project and start; Accept, Stop and the menu (D67). */
export function TicketViewHeader({
  row,
  actions
}: {
  row: TicketRowModel
  actions: TicketHeaderActions
}): React.JSX.Element {
  const t = useTranslate()
  const statusLabels = useTicketStatusLabels()
  const now = useNow(60_000)
  const started = formatPaletteSessionAge(Date.parse(row.startedAt), now, t)
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-border px-6 py-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{row.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <TicketStateGlyph state={row.state} />
            {statusLabels[statusOf(row)]}
          </span>
          {row.projectName && <span>{row.projectName}</span>}
          {started && (
            <span>{t('tmwk.ticketView.started', 'Started {{age}} ago', { age: started })}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions.onAccept && (
          <Button size="sm" onClick={actions.onAccept} disabled={actions.busy}>
            <Check className="size-4" />
            {t('tmwk.ticketView.accept', 'Accept')}
          </Button>
        )}
        {actions.onStop && (
          <Button size="sm" variant="ghost" onClick={actions.onStop} disabled={actions.busy}>
            <Square className="size-4" />
            {t('tmwk.ticketView.stop', 'Stop')}
          </Button>
        )}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('tmwk.ticketView.more', 'More ticket actions')}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={actions.onOpenInChat}>
              <MessageCircle className="size-4" />
              {t('tmwk.ticketView.openInChat', 'Open in Chat')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={actions.onCopyId}>
              <Copy className="size-4" />
              {t('tmwk.ticketView.copyId', 'Copy ID')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
