import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketDecision } from '../../../../../shared/tmwk/ticket-view'
import type { TmwkTicketRecord } from '../../../../../shared/tmwk/tmwk-ticket-record'
import { useReportTime } from '../tickets/ticket-row-parts'
import { THREAD_TAIL, ticketThreadItems, type TicketThreadItem } from './ticket-thread-items'

function ThreadItem({ item }: { item: TicketThreadItem }): React.JSX.Element {
  const reportTime = useReportTime()
  if (item.kind === 'you') {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2 text-sm">
        {item.text}
      </div>
    )
  }
  if (item.kind === 'report') {
    return (
      <div className="text-sm leading-6">
        <div className="whitespace-pre-wrap">{item.text}</div>
        {item.detail && (
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.detail}</div>
        )}
      </div>
    )
  }
  const time = reportTime(item.at)
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs',
        item.failed ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {item.agent && <AgentIcon agent={item.agent} size={12} className="shrink-0" />}
      <span className="min-w-0">{item.text}</span>
      {time && <span className="shrink-0 tabular-nums">· {time}</span>}
    </div>
  )
}

/** The ticket's history, oldest first; the goal and older events fold under one row. */
export function TicketThread({
  ticket,
  decision,
  children
}: {
  ticket: TmwkTicketRecord
  decision: TicketDecision | null
  /** Drawn after the history: the pending decision. */
  children?: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const all = ticketThreadItems(ticket, decision)
  // The request stays in view above the latest events, as the thread's subject.
  const request = all[0]?.kind === 'you' ? all[0] : null
  const items = request ? all.slice(1) : all
  const earlier = Math.max(0, items.length - THREAD_TAIL)
  const goal = ticket.goal?.trim() || null
  const folded = goal !== null || earlier > 0
  const shown = [...(request ? [request] : []), ...(expanded ? items : items.slice(earlier))]
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <div className="flex flex-col gap-3">
      {folded && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 self-start rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Chevron className="size-3" />
          {goal === null
            ? t('tmwk.ticketView.earlierEvents', '{{count}} earlier events', {
                count: earlier,
                defaultValue_one: '{{count}} earlier event'
              })
            : earlier === 0
              ? t('tmwk.ticketView.instructions', 'Instructions')
              : t(
                  'tmwk.ticketView.instructionsAndEarlier',
                  'Instructions and {{count}} earlier events',
                  {
                    count: earlier,
                    defaultValue_one: 'Instructions and {{count}} earlier event'
                  }
                )}
        </button>
      )}
      {expanded && goal && (
        <div className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-[13px] leading-5 text-muted-foreground">
          {goal}
        </div>
      )}
      {shown.map((item) => (
        <ThreadItem key={item.key} item={item} />
      ))}
      {children}
    </div>
  )
}
