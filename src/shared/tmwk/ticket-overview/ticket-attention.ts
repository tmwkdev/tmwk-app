import type { TicketRowModel, TicketState } from './ticket-row-model'

export type NeedsYouState = Extract<TicketState, 'decision' | 'stop' | 'result'>

export type AttentionSection = 'needsYou' | 'quiet' | 'done'

export type AttentionSections = Record<AttentionSection, TicketRowModel[]>

export type NeedsYouSummary = Record<NeedsYouState, number> & { total: number }

// The attention order everywhere: what needs you (decision, stop, result), then quiet work, then done.
const STATE_RANK: Record<TicketState, number> = {
  decision: 0,
  stop: 1,
  result: 2,
  running: 3,
  waiting: 4,
  paused: 5,
  done: 6
}

export function isNeedsYou(row: Pick<TicketRowModel, 'state'>): boolean {
  return row.state === 'decision' || row.state === 'stop' || row.state === 'result'
}

export function attentionSectionOf(row: Pick<TicketRowModel, 'state'>): AttentionSection {
  if (isNeedsYou(row)) {
    return 'needsYou'
  }
  return row.state === 'done' ? 'done' : 'quiet'
}

/** State rank, ongoing quiet tickets after the rest, then newest change first. */
export function compareByAttention(a: TicketRowModel, b: TicketRowModel): number {
  const ongoingLast = (row: TicketRowModel): number =>
    row.kind === 'ongoing' && !isNeedsYou(row) ? 1 : 0
  return (
    ongoingLast(a) - ongoingLast(b) ||
    STATE_RANK[a.state] - STATE_RANK[b.state] ||
    b.changedAt - a.changedAt
  )
}

export function attentionSections(rows: readonly TicketRowModel[]): AttentionSections {
  const sections: AttentionSections = { needsYou: [], quiet: [], done: [] }
  for (const row of [...rows].sort(compareByAttention)) {
    sections[attentionSectionOf(row)].push(row)
  }
  return sections
}

export function needsYouSummary(rows: readonly TicketRowModel[]): NeedsYouSummary {
  const summary: NeedsYouSummary = { total: 0, decision: 0, stop: 0, result: 0 }
  for (const row of rows) {
    if (row.state === 'decision' || row.state === 'stop' || row.state === 'result') {
      summary[row.state] += 1
      summary.total += 1
    }
  }
  return summary
}
