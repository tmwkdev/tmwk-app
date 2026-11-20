import type { TmwkHealthEvent } from '../../../shared/tmwk/tmwk-health'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import {
  TMWK_ERROR_KINDS,
  type TmwkTelemetryEventName
} from '../../../shared/tmwk/tmwk-telemetry-events'
import { countTicketOutcomes } from '../tickets/ticket-outcome-counts'

export type TmwkTelemetryEvent = { event: TmwkTelemetryEventName; props: Record<string, unknown> }

/** Count events for the window since `since`; failure messages, stages and codes never leave this function. */
export function buildTmwkCountEvents(
  events: readonly TmwkHealthEvent[],
  records: readonly TmwkTicketRecord[],
  since: number
): TmwkTelemetryEvent[] {
  const recent = events.filter((event) => Date.parse(event.at) >= since)
  const out: TmwkTelemetryEvent[] = []
  for (const kind of TMWK_ERROR_KINDS) {
    let count = 0
    for (const event of recent) {
      if (event.type === 'failure' && event.kind === kind) {
        count += event.repeats
      }
    }
    if (count > 0) {
      out.push({ event: 'tmwk_errors_counted', props: { kind, count } })
    }
  }
  const rollovers = { stored: 0, fallback: 0, stale: 0 }
  for (const event of recent) {
    if (event.type === 'rollover') {
      rollovers[event.summary] += 1
    }
  }
  if (rollovers.stored + rollovers.fallback + rollovers.stale > 0) {
    out.push({ event: 'tmwk_rollovers_counted', props: rollovers })
  }
  const tickets = countTicketOutcomes(records, since)
  if (tickets.completed + tickets.failed + tickets.lost + tickets.open > 0) {
    out.push({ event: 'tmwk_ticket_outcomes_counted', props: { ...tickets } })
  }
  return out
}
