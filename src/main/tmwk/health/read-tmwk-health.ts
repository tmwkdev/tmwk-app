import type {
  TmwkHealthEvent,
  TmwkHealthFailure,
  TmwkHealthView
} from '../../../shared/tmwk/tmwk-health'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { countTicketOutcomes } from '../tickets/ticket-outcome-counts'
import { openTmwkHealthStore } from './record-tmwk-health'

export const HEALTH_WINDOW_DAYS = 7
const HEALTH_FAILURES_SHOWN = 5
const DAY_MS = 24 * 60 * 60 * 1000

export function buildTmwkHealthView(
  events: readonly TmwkHealthEvent[],
  records: readonly TmwkTicketRecord[],
  now: number
): TmwkHealthView {
  const since = now - HEALTH_WINDOW_DAYS * DAY_MS
  const recent = events.filter((event) => Date.parse(event.at) >= since)
  const rollovers = { stored: 0, fallback: 0, stale: 0 }
  for (const event of recent) {
    if (event.type === 'rollover') {
      rollovers[event.summary] += 1
    }
  }
  return {
    windowDays: HEALTH_WINDOW_DAYS,
    failures: recent
      .filter((event): event is TmwkHealthFailure => event.type === 'failure')
      .toSorted((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, HEALTH_FAILURES_SHOWN),
    rollovers,
    tickets: countTicketOutcomes(records, since)
  }
}

export async function readTmwkHealth(now = Date.now()): Promise<TmwkHealthView> {
  const [events, { records }] = await Promise.all([
    openTmwkHealthStore().list(),
    openTmwkTicketStore().records()
  ])
  return buildTmwkHealthView(events, records, now)
}
