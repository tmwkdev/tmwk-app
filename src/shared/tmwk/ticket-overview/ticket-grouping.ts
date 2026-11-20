import {
  attentionSectionOf,
  compareByAttention,
  isNeedsYou,
  type AttentionSection
} from './ticket-attention'
import type { TicketRowModel } from './ticket-row-model'
import { normalizeStatusOrder, statusOf, type TicketStatus } from './ticket-status'

export type TicketGroupBy = 'attention' | 'status' | 'project' | 'host' | 'none'

export type TicketSortWithin = 'attention' | 'lastActivity' | 'newest' | 'oldest'

export type TicketGroupOptions = {
  groupBy: TicketGroupBy
  sortWithin: TicketSortWithin
  hideDone: boolean
  hideOngoing: boolean
  hideQuiet: boolean
  /** Group by Status only; unknown entries are dropped and missing ones appended. */
  statusOrder?: readonly string[]
}

export type TicketGroupKey =
  | { by: 'attention'; section: AttentionSection }
  | { by: 'status'; status: TicketStatus }
  | { by: 'project'; projectId: string | null; projectName: string | null }
  | { by: 'host'; hostId: string | null; hostLabel: string | null }
  | { by: 'none' }

export type TicketGroup = { id: string; key: TicketGroupKey; rows: TicketRowModel[] }

export const DEFAULT_TICKET_GROUP_OPTIONS: TicketGroupOptions = {
  groupBy: 'attention',
  sortWithin: 'attention',
  hideDone: false,
  hideOngoing: false,
  hideQuiet: false
}

// Filters never hide what needs you.
function isVisible(row: TicketRowModel, options: TicketGroupOptions): boolean {
  if (isNeedsYou(row)) {
    return true
  }
  if (options.hideDone && row.state === 'done') {
    return false
  }
  if (options.hideOngoing && row.kind === 'ongoing') {
    return false
  }
  return !(options.hideQuiet && row.state !== 'done')
}

function timeOf(value: string | null): number {
  const time = value === null ? Number.NaN : Date.parse(value)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

const COMPARE: Record<TicketSortWithin, (a: TicketRowModel, b: TicketRowModel) => number> = {
  attention: compareByAttention,
  lastActivity: (a, b) =>
    timeOf(b.lastActivityAt) - timeOf(a.lastActivityAt) || compareByAttention(a, b),
  newest: (a, b) => timeOf(b.startedAt) - timeOf(a.startedAt) || compareByAttention(a, b),
  oldest: (a, b) => timeOf(a.startedAt) - timeOf(b.startedAt) || compareByAttention(a, b)
}

// Named groups sort by name; the unnamed group (no project, no host) goes last.
function compareNames(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null)
  }
  return a.localeCompare(b)
}

function bucket<K extends string>(
  rows: TicketRowModel[],
  keyOf: (row: TicketRowModel) => K
): Map<K, TicketRowModel[]> {
  const buckets = new Map<K, TicketRowModel[]>()
  for (const row of rows) {
    const key = keyOf(row)
    buckets.set(key, [...(buckets.get(key) ?? []), row])
  }
  return buckets
}

function groupsOf(rows: TicketRowModel[], options: TicketGroupOptions): TicketGroup[] {
  switch (options.groupBy) {
    case 'attention': {
      const buckets = bucket(rows, attentionSectionOf)
      return (['needsYou', 'quiet', 'done'] as const).map((section) => ({
        id: `attention:${section}`,
        key: { by: 'attention', section },
        rows: buckets.get(section) ?? []
      }))
    }
    case 'status': {
      const buckets = bucket(rows, statusOf)
      return normalizeStatusOrder(options.statusOrder).map((status) => ({
        id: `status:${status}`,
        key: { by: 'status', status },
        rows: buckets.get(status) ?? []
      }))
    }
    case 'project': {
      const buckets = bucket(rows, (row) => row.projectId ?? '')
      return [...buckets.values()]
        .map((group): TicketGroup => {
          const { projectId, projectName } = group[0]
          return {
            id: `project:${projectId ?? ''}`,
            key: { by: 'project', projectId, projectName },
            rows: group
          }
        })
        .sort((a, b) => compareNames(projectNameOf(a), projectNameOf(b)))
    }
    case 'host': {
      const buckets = bucket(rows, (row) => row.host?.id ?? '')
      return [...buckets.values()]
        .map((group): TicketGroup => {
          const host = group[0].host
          return {
            id: `host:${host?.id ?? ''}`,
            key: { by: 'host', hostId: host?.id ?? null, hostLabel: host?.label ?? null },
            rows: group
          }
        })
        .sort((a, b) => compareNames(hostLabelOf(a), hostLabelOf(b)))
    }
    case 'none':
      return [{ id: 'none', key: { by: 'none' }, rows }]
  }
}

function projectNameOf(group: TicketGroup): string | null {
  return group.key.by === 'project' ? (group.key.projectName ?? group.key.projectId) : null
}

function hostLabelOf(group: TicketGroup): string | null {
  return group.key.by === 'host' ? (group.key.hostLabel ?? group.key.hostId) : null
}

/** Filters, groups and sorts rows for the sidebar. Empty groups are dropped, except Attention's Needs you. */
export function groupTickets(
  rows: readonly TicketRowModel[],
  options: TicketGroupOptions
): TicketGroup[] {
  const visible = rows.filter((row) => isVisible(row, options))
  const compare = COMPARE[options.sortWithin]
  return groupsOf(visible, options)
    .map((group) => ({ ...group, rows: [...group.rows].sort(compare) }))
    .filter(
      (group) =>
        group.rows.length > 0 || (group.key.by === 'attention' && group.key.section === 'needsYou')
    )
}
