import { join } from 'node:path'
import { isTmwkTicket, type TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import { tmwkError } from '../tmwk-error'
import { readCountedStoreFile, serializeStoreWrite, writeStoreFile } from '../store/tmwk-store-file'
import { classifyNeedsMe } from './needs-me-order'

/** What the orchestration reads show for one task; the store adds the fields tmwk owns. */
export type LiveTicket = Pick<
  TmwkTicket,
  'taskId' | 'runId' | 'title' | 'status' | 'result' | 'completedAt' | 'question' | 'owner'
>

export type TicketChange = { ticket: TmwkTicket; previous: TmwkTicket | null }

export type TicketList = { version: number; tickets: TmwkTicket[] }

export type TicketSnapshotStore = {
  /**
   * Upserts every live task; only snapshots whose observable fields changed move to a new version.
   * A task that was never finished and is no longer live is dropped, except in `unreadRunIds`.
   */
  refresh(
    live: LiveTicket[],
    options?: { unreadRunIds?: readonly string[] }
  ): Promise<{ version: number; changes: TicketChange[] }>
  accept(taskId: string): Promise<TicketChange>
  list(filter?: { needsMe?: boolean; since?: number }): Promise<TicketList>
}

const TERMINAL_STATUSES: ReadonlySet<TmwkTicket['status']> = new Set(['completed', 'failed'])

function observableKey(ticket: TmwkTicket): string {
  return JSON.stringify([
    ticket.status,
    ticket.result,
    ticket.needsMe,
    ticket.question,
    ticket.title,
    ticket.acceptedAt
  ])
}

export function createTicketSnapshotStore(storeDir: string): TicketSnapshotStore {
  const path = join(storeDir, 'tickets.json')
  const read = () => readCountedStoreFile(path, 'tickets', isTmwkTicket)
  return {
    refresh: (live, { unreadRunIds = [] } = {}) =>
      serializeStoreWrite(path, async () => {
        const { items, counter: start } = await read()
        let counter = start
        const byId = new Map(items.map((ticket) => [ticket.taskId, ticket]))
        const now = new Date().toISOString()
        const changes: TicketChange[] = []
        const liveIds = new Set(live.map((entry) => entry.taskId))
        let removed = false
        for (const [taskId, previous] of byId) {
          if (
            !liveIds.has(taskId) &&
            !unreadRunIds.includes(previous.runId) &&
            !TERMINAL_STATUSES.has(previous.status)
          ) {
            byId.delete(taskId)
            removed = true
          }
        }
        for (const entry of live) {
          const previous = byId.get(entry.taskId) ?? null
          const sameOutcome =
            previous !== null &&
            previous.status === entry.status &&
            previous.result === entry.result &&
            previous.completedAt === entry.completedAt
          const acceptedAt = sameOutcome ? previous.acceptedAt : null
          const next: TmwkTicket = {
            ...entry,
            firstSeenAt: previous?.firstSeenAt ?? now,
            lastSeenAt: now,
            acceptedAt,
            changedAt: previous?.changedAt ?? 0,
            needsMe: classifyNeedsMe({ ...entry, acceptedAt })
          }
          if (previous === null || observableKey(previous) !== observableKey(next)) {
            next.changedAt = ++counter
            changes.push({ ticket: next, previous })
            byId.set(entry.taskId, next)
          }
        }
        if (changes.length > 0 || removed) {
          await writeStoreFile(path, 'tickets', [...byId.values()], counter)
        }
        return { version: counter, changes }
      }),
    accept: (taskId) =>
      serializeStoreWrite(path, async () => {
        const { items, counter } = await read()
        const previous = items.find((ticket) => ticket.taskId === taskId)
        if (!previous) {
          throw tmwkError('unknown_ticket', `no ticket ${taskId}`)
        }
        if (previous.acceptedAt !== null) {
          return { ticket: previous, previous }
        }
        const acceptedAt = new Date().toISOString()
        const ticket: TmwkTicket = {
          ...previous,
          acceptedAt,
          needsMe: classifyNeedsMe({ ...previous, acceptedAt }),
          changedAt: counter + 1
        }
        await writeStoreFile(
          path,
          'tickets',
          items.map((item) => (item.taskId === taskId ? ticket : item)),
          counter + 1
        )
        return { ticket, previous }
      }),
    list: (filter = {}) =>
      serializeStoreWrite(path, async () => {
        const { items, counter } = await read()
        const since = filter.since
        return {
          version: counter,
          tickets: items.filter(
            (ticket) =>
              (!filter.needsMe || ticket.needsMe !== null) &&
              (since === undefined || ticket.changedAt > since)
          )
        }
      })
  }
}
