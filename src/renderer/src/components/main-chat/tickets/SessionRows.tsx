import React from 'react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { TicketSessionGlyph } from './ticket-glyphs'
import { sessionItemKey } from './ticket-list-items'

/** A ticket's sessions, one disclosure beneath it: status, agent and role. */
export function SessionRows({
  row,
  activeKey,
  onOpenSession,
  onFocusItem
}: {
  row: TicketRowModel
  activeKey: string | null
  onOpenSession: (session: TicketRowSession, row: TicketRowModel) => void
  onFocusItem: (key: string) => void
}): React.JSX.Element {
  return (
    <div role="group" className="flex flex-col pb-1">
      {row.sessions.map((session) => {
        const key = sessionItemKey(row.id, session.id)
        return (
          <div
            key={session.id}
            role="option"
            aria-selected={false}
            data-ticket-item={key}
            tabIndex={activeKey === key ? 0 : -1}
            onClick={() => onOpenSession(session, row)}
            onFocus={() => onFocusItem(key)}
            className="flex h-7 cursor-default items-center gap-2 rounded-md pl-7 pr-2 text-[13px] text-worktree-sidebar-foreground/85 outline-none hover:bg-worktree-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
          >
            <TicketSessionGlyph status={session.status} />
            <AgentIcon agent={session.agent} size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{session.role}</span>
          </div>
        )
      })}
    </div>
  )
}
