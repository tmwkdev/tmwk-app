import { create } from 'zustand'
import type {
  TicketGroupBy,
  TicketGroupOptions,
  TicketSortWithin
} from '../../../../../shared/tmwk/ticket-overview/ticket-grouping'
import {
  DEFAULT_TICKET_STATUS_ORDER,
  normalizeStatusOrder,
  type TicketStatus
} from '../../../../../shared/tmwk/ticket-overview/ticket-status'

export type TicketDensity = 'two-line' | 'one-line'

export type TicketRowField = 'reason' | 'project' | 'host' | 'agent' | 'lastActivity' | 'pr'

export type TicketShowOnRows = Record<TicketRowField, boolean>

/** Ticket options (D66): per-user view preferences, never work state. */
export type TicketOptions = TicketGroupOptions & {
  density: TicketDensity
  showOnRows: TicketShowOnRows
  statusOrder: TicketStatus[]
}

export const TICKET_ROW_FIELDS: readonly TicketRowField[] = [
  'reason',
  'project',
  'host',
  'agent',
  'lastActivity',
  'pr'
]

export const DEFAULT_TICKET_OPTIONS: TicketOptions = {
  groupBy: 'attention',
  sortWithin: 'attention',
  density: 'two-line',
  showOnRows: {
    reason: true,
    project: false,
    host: false,
    agent: false,
    lastActivity: false,
    pr: false
  },
  hideDone: false,
  hideOngoing: false,
  hideQuiet: false,
  statusOrder: [...DEFAULT_TICKET_STATUS_ORDER]
}

const STORAGE_KEY = 'tmwk.ticketOptions.v1'

export const TICKET_GROUP_BYS: readonly TicketGroupBy[] = [
  'attention',
  'status',
  'project',
  'host',
  'none'
]
export const TICKET_SORTS: readonly TicketSortWithin[] = [
  'attention',
  'lastActivity',
  'newest',
  'oldest'
]
export const TICKET_DENSITIES: readonly TicketDensity[] = ['two-line', 'one-line']

/** The allowed option equal to `value`, if any. */
export function pickOption<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value)
}

function entriesOf(value: unknown): Map<string, unknown> {
  return new Map(typeof value === 'object' && value !== null ? Object.entries(value) : [])
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** A saved value field by field; anything missing or malformed takes its default. */
export function parseTicketOptions(raw: string | null): TicketOptions {
  let value: unknown
  try {
    value = raw === null ? null : JSON.parse(raw)
  } catch {
    return DEFAULT_TICKET_OPTIONS
  }
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_TICKET_OPTIONS
  }
  const saved = entriesOf(value)
  const d = DEFAULT_TICKET_OPTIONS
  const rows = entriesOf(saved.get('showOnRows'))
  const shown = (field: TicketRowField): boolean => bool(rows.get(field), d.showOnRows[field])
  const statusOrder = saved.get('statusOrder')
  return {
    groupBy: pickOption(saved.get('groupBy'), TICKET_GROUP_BYS) ?? d.groupBy,
    sortWithin: pickOption(saved.get('sortWithin'), TICKET_SORTS) ?? d.sortWithin,
    density: pickOption(saved.get('density'), TICKET_DENSITIES) ?? d.density,
    showOnRows: {
      reason: shown('reason'),
      project: shown('project'),
      host: shown('host'),
      agent: shown('agent'),
      lastActivity: shown('lastActivity'),
      pr: shown('pr')
    },
    hideDone: bool(saved.get('hideDone'), d.hideDone),
    hideOngoing: bool(saved.get('hideOngoing'), d.hideOngoing),
    hideQuiet: bool(saved.get('hideQuiet'), d.hideQuiet),
    statusOrder: normalizeStatusOrder(
      Array.isArray(statusOrder)
        ? statusOrder.filter((s): s is string => typeof s === 'string')
        : undefined
    )
  }
}

function readStored(): TicketOptions {
  try {
    return parseTicketOptions(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_TICKET_OPTIONS
  }
}

function writeStored(options: TicketOptions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // Best-effort: unavailable storage keeps the choice for this session only.
  }
}

type TicketOptionsStore = {
  options: TicketOptions
  setOptions: (patch: Partial<TicketOptions>) => void
  setShowOnRow: (field: TicketRowField, shown: boolean) => void
  clearRowFilters: () => void
  resetStatusOrder: () => void
}

export const useTicketOptionsStore = create<TicketOptionsStore>((set, get) => {
  const update = (patch: Partial<TicketOptions>): void => {
    const options = { ...get().options, ...patch }
    writeStored(options)
    set({ options })
  }
  return {
    options: readStored(),
    setOptions: update,
    setShowOnRow: (field, shown) =>
      update({ showOnRows: { ...get().options.showOnRows, [field]: shown } }),
    clearRowFilters: () => update({ hideDone: false, hideOngoing: false, hideQuiet: false }),
    resetStatusOrder: () => update({ statusOrder: [...DEFAULT_TICKET_STATUS_ORDER] })
  }
})

export function useTicketOptions(): TicketOptions {
  return useTicketOptionsStore((s) => s.options)
}

export function activeRowFilterCount(options: TicketOptions): number {
  return Number(options.hideDone) + Number(options.hideOngoing) + Number(options.hideQuiet)
}
