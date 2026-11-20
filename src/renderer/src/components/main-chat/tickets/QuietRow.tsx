import React from 'react'
import { cn } from '@/lib/class-names'
import { TicketStateGlyph } from './ticket-glyphs'
import {
  RowDisclosure,
  OngoingMark,
  TicketRowFrame,
  TicketRowMeta,
  TicketTitle,
  useUnreachableHostText,
  type TicketRowProps
} from './ticket-row-parts'

/** A Quiet or Done row: one line, plus a second only for a paused ticket or what an ongoing one handled, when density and Show on rows allow. */
export function QuietRow(props: TicketRowProps): React.JSX.Element {
  const { row, collides, display } = props
  const unreachable = useUnreachableHostText(row.host)
  const secondAllowed = display.density === 'two-line' && display.showOnRows.reason
  const second = !secondAllowed
    ? null
    : row.state === 'paused'
      ? (unreachable ?? row.reason)
      : row.kind === 'ongoing'
        ? row.handled
        : null
  return (
    <TicketRowFrame {...props} className={second ? 'py-1.5' : 'flex h-7 items-center'}>
      <div className="flex w-full items-center gap-2">
        <TicketStateGlyph state={row.state} />
        <TicketTitle
          row={row}
          collides={collides}
          className={cn(
            'text-[13px]',
            row.state === 'done' ? 'text-muted-foreground' : 'text-worktree-sidebar-foreground/90'
          )}
        />
        <OngoingMark row={row} />
        <TicketRowMeta row={row} fields={display.showOnRows} explainHost={!secondAllowed} />
        <RowDisclosure {...props} />
      </div>
      {second && <div className="truncate pl-5 pr-6 text-xs text-muted-foreground">{second}</div>}
    </TicketRowFrame>
  )
}
