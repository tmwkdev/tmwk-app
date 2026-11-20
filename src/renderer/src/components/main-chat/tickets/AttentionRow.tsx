import React from 'react'
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

/** A Needs you row: its reason is the second line, up to two lines, at every density; an unreachable host never hides it. */
export function AttentionRow(props: TicketRowProps): React.JSX.Element {
  const { row, collides } = props
  const unreachable = useUnreachableHostText(row.host)
  return (
    <TicketRowFrame {...props} className="py-1.5">
      <div className="flex items-center gap-2">
        <TicketStateGlyph state={row.state} />
        <TicketTitle row={row} collides={collides} className="text-[13px] font-medium" />
        <OngoingMark row={row} />
        <TicketRowMeta row={row} fields={props.display.showOnRows} />
        <RowDisclosure {...props} />
      </div>
      {row.reason && (
        <div className="line-clamp-2 pl-5 pr-6 text-xs leading-4 text-worktree-sidebar-foreground/70">
          {row.reason}
        </div>
      )}
      {unreachable && (
        <div className="truncate pl-5 pr-6 text-xs leading-4 text-muted-foreground">
          {unreachable}
        </div>
      )}
    </TicketRowFrame>
  )
}
