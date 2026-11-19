import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { onMainTurn } from '../rollover/main-session-turns'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import { readLiveTickets } from './read-live-tickets'
import type { TicketChange } from './ticket-snapshot-store'

const chains = new WeakMap<OrcaRuntimeService, Promise<unknown>>()

function needsUserAttention(change: TicketChange): boolean {
  return change.ticket.needsMe !== null && (change.previous?.needsMe ?? null) === null
}

function questionAnswered(change: TicketChange): boolean {
  return change.previous?.needsMe === 'decision' && change.ticket.needsMe !== 'decision'
}

/** A ticket newly needing the user, or a gate or question answered, wakes the non-forced summary refresh (D28). */
function requestSummaryRefreshForTickets(
  runtime: OrcaRuntimeService,
  changes: TicketChange[]
): void {
  if (changes.some((change) => needsUserAttention(change) || questionAnswered(change))) {
    void requestSummaryRefresh(runtime, { reason: 'ticket' })
  }
}

/** Reads live orchestration state and upserts snapshots, one at a time per runtime. A failed read leaves the stored snapshots as they are. */
export function refreshTicketSnapshots(runtime: OrcaRuntimeService): Promise<TicketChange[]> {
  const run = (chains.get(runtime) ?? Promise.resolve()).then(async () => {
    try {
      const { tickets, unreadRunIds } = await readLiveTickets(createTmwkRpc(runtime))
      const { changes } = await openTmwkTicketStore().refresh(tickets, { unreadRunIds })
      requestSummaryRefreshForTickets(runtime, changes)
      return changes
    } catch (error) {
      console.error('[tmwk] ticket snapshot refresh failed:', error)
      return []
    }
  })
  chains.set(runtime, run)
  return run
}

/** Snapshots once now, then after each completed pinned-session turn; no timers. */
export function startTicketSnapshotRefresh(runtime: OrcaRuntimeService): void {
  void refreshTicketSnapshots(runtime)
  onMainTurn(runtime, (event) => {
    if (event.type === 'completion') {
      void refreshTicketSnapshots(runtime)
    }
  })
}
