import { useEffect, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import { targetForKey } from '../use-main-chat-host'
import { useTicketMutationCount } from '../tickets/use-ticket-overview'

const VIEW_REFETCH_MS = 15_000

export type TicketViewRead = {
  /** The last view read for this ticket; null until the first read lands. */
  view: TmwkTicketView | null
  /** The last read failed; `view` is the previous one. */
  error: string | null
}

/** `tmwk.ticketView` for one ticket, refetched on a visible-window timer and after each ticket mutation. */
export function useTicketView(targetKey: string | null, ticketId: string): TicketViewRead {
  const [read, setRead] = useState<TicketViewRead & { ticketId: string }>({
    ticketId,
    view: null,
    error: null
  })
  const mutations = useTicketMutationCount()
  useEffect(() => {
    if (!targetKey) {
      return
    }
    const target = targetForKey(targetKey)
    let active = true
    const load = (): void => {
      void callRuntimeRpc<TmwkTicketView>(target, 'tmwk.ticketView', { ticket: ticketId })
        .then((view) => {
          if (active) {
            setRead({ ticketId, view, error: null })
          }
        })
        .catch((error: unknown) => {
          console.error('tmwk ticket view read failed', error)
          if (active) {
            setRead((previous) => ({
              ticketId,
              view: previous.ticketId === ticketId ? previous.view : null,
              error: error instanceof Error ? error.message : String(error)
            }))
          }
        })
    }
    load()
    const stopInterval = installWindowVisibilityInterval({ run: load, intervalMs: VIEW_REFETCH_MS })
    return () => {
      active = false
      stopInterval()
    }
  }, [targetKey, ticketId, mutations])
  return read.ticketId === ticketId ? read : { view: null, error: null }
}
