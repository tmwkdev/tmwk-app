import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketRowSession } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import { DecisionCard } from './DecisionCard'
import { TicketComposer } from './TicketComposer'
import { TicketRail } from './TicketRail'
import { TicketThread } from './TicketThread'
import { TicketViewHeader, type TicketHeaderActions } from './TicketViewHeader'

export type TicketViewProps = {
  view: TmwkTicketView
  actions: TicketHeaderActions
  onOpenSession: (session: TicketRowSession) => void
  onWatchAll?: () => void
  onAnswer?: (answer: string) => void
  onMessage?: (text: string) => void
  /** Drawn under the thread, above the composer: delivery notes. */
  notices?: React.ReactNode
}

/**
 * One ticket inside the main view (D65): its conversation with the owner, the pending decision,
 * "Message the owner", and T4's quiet rail, which folds into a Details disclosure under 900 px.
 */
export function TicketView({
  view,
  actions,
  onOpenSession,
  onWatchAll,
  onAnswer,
  onMessage,
  notices
}: TicketViewProps): React.JSX.Element {
  const t = useTranslate()
  const rail = <TicketRail row={view.row} onOpenSession={onOpenSession} onWatchAll={onWatchAll} />
  return (
    <div className="@container flex h-full min-h-0 flex-col bg-background text-foreground">
      <TicketViewHeader row={view.row} actions={actions} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col items-center px-6">
          <div className="scrollbar-sleek flex w-full flex-1 justify-center overflow-y-auto">
            <div className="flex w-full max-w-[620px] flex-col gap-3 py-5">
              <div className="rounded-lg border border-border @min-[900px]:hidden">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group flex w-full items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none" />
                      {t('tmwk.ticketView.details', 'Details')}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-1 pb-3">{rail}</div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <TicketThread ticket={view.ticket} decision={view.decision}>
                {view.decision && (
                  <DecisionCard decision={view.decision} onAnswer={onAnswer} busy={actions.busy} />
                )}
              </TicketThread>
              {notices}
            </div>
          </div>
          <div className="mb-5 w-full max-w-[620px] shrink-0">
            <TicketComposer onSend={onMessage} />
          </div>
        </div>
        <aside className="scrollbar-sleek w-60 shrink-0 overflow-y-auto border-l border-border px-3 py-5 @max-[899px]:hidden">
          {rail}
        </aside>
      </div>
    </div>
  )
}
