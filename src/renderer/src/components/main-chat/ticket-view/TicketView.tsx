import React, { useLayoutEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketRowSession } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import { DecisionCard } from './DecisionCard'
import { TicketComposer } from './TicketComposer'
import { TicketRail } from './TicketRail'
import { TicketThread, type RetrySent } from './TicketThread'
import { answerFor } from './ticket-thread-items'
import { TicketViewHeader, type TicketHeaderActions } from './TicketViewHeader'

export type TicketViewProps = {
  view: TmwkTicketView
  actions: TicketHeaderActions
  onOpenSession: (session: TicketRowSession) => void
  onWatchAll?: () => void
  onAnswer?: (answer: string) => void
  onMessage?: (text: string) => void
  onRetry?: RetrySent
  /** Why the composer cannot send, shown as its placeholder. */
  composerNote?: string
  /** Drawn under the thread, above the composer: delivery notes. */
  notices?: React.ReactNode
}

/** The text of an answer still on its way to this decision; a failed one leaves the card open (D61). */
function pendingAnswer(view: TmwkTicketView): string | null {
  const sent = view.decision ? answerFor(view.ticket, view.decision) : null
  return sent && sent.delivery?.status !== 'failed' ? sent.text : null
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
  onRetry,
  composerNote,
  notices
}: TicketViewProps): React.JSX.Element {
  const t = useTranslate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyLength = view.ticket.history.length
  const decisionId = view.decision?.id ?? null
  // Open at, and follow, the latest event and the pending decision, as a chat does.
  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [historyLength, decisionId])
  const rail = <TicketRail row={view.row} onOpenSession={onOpenSession} onWatchAll={onWatchAll} />
  return (
    <div className="@container flex h-full min-h-0 flex-col bg-background text-foreground">
      <TicketViewHeader row={view.row} actions={actions} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col items-center px-6">
          <div
            ref={scrollRef}
            className="scrollbar-sleek flex w-full flex-1 justify-center overflow-y-auto"
          >
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
              <TicketThread ticket={view.ticket} decision={view.decision} onRetry={onRetry}>
                {view.decision && (
                  <DecisionCard
                    decision={view.decision}
                    onAnswer={onAnswer}
                    busy={actions.busy}
                    sentAnswer={pendingAnswer(view)}
                  />
                )}
              </TicketThread>
              {notices}
            </div>
          </div>
          <div className="mb-5 w-full max-w-[620px] shrink-0">
            <TicketComposer onSend={onMessage} busy={actions.busy} placeholder={composerNote} />
          </div>
        </div>
        <aside className="scrollbar-sleek w-60 shrink-0 overflow-y-auto border-l border-border px-3 py-5 @max-[899px]:hidden">
          {rail}
        </aside>
      </div>
    </div>
  )
}
