import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { recordTmwkFailure } from '../health/record-tmwk-health'
import { createTmwkRpc, createTmwkServerRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { onMainTurn } from '../rollover/main-session-turns'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import { readLiveTickets } from './read-live-tickets'
import { readAttemptFacts } from './read-attempt-facts'
import { readTaskDispatches } from './read-task-dispatches'
import type { TicketChange } from './ticket-store'
import { startTicketWorktreeCleanup } from './ticket-worktree-cleanup'

// A paired server's read must not hold the ticket list up for long.
const SERVER_READ_TIMEOUT_MS = 5000

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
      const rpc = createTmwkRpc(runtime)
      const store = openTmwkTicketStore()
      const { tickets, unreadRunIds } = await readLiveTickets(rpc)
      const dispatches = await readTaskDispatches(rpc, (await store.records()).records, tickets)
      const facts = await readAttemptFacts(rpc, await store.followed(), (server) =>
        createTmwkServerRpc(runtime, server, SERVER_READ_TIMEOUT_MS)
      )
      const { changes } = await store.refresh(tickets, { unreadRunIds, facts, dispatches })
      requestSummaryRefreshForTickets(runtime, changes)
      // Retries worktrees accept left in place, now that they may be safe to remove.
      startTicketWorktreeCleanup(runtime)
      return changes
    } catch (error) {
      void recordTmwkFailure('ticket-refresh', 'snapshot', error)
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
