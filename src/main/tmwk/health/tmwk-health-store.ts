import { join } from 'node:path'
import {
  TmwkHealthEventSchema,
  type TmwkHealthEvent,
  type TmwkHealthFailure,
  type TmwkHealthRollover
} from '../../../shared/tmwk/tmwk-health'
import { readStoreFile, serializeStoreWrite, writeStoreFile } from '../store/tmwk-store-file'

export const HEALTH_FAILURES_KEEP = 50
export const HEALTH_ROLLOVERS_KEEP = 200

export type NewHealthFailure = Omit<TmwkHealthFailure, 'type' | 'repeats'>

export type TmwkHealthStore = {
  /** Oldest first. */
  list(): Promise<TmwkHealthEvent[]>
  addFailure(failure: NewHealthFailure): Promise<void>
  addRollover(rollover: Omit<TmwkHealthRollover, 'type'>): Promise<void>
}

const isHealthEvent = (value: unknown): value is TmwkHealthEvent =>
  TmwkHealthEventSchema.safeParse(value).success

function sameFailure(event: TmwkHealthFailure, next: NewHealthFailure): boolean {
  return event.kind === next.kind && event.stage === next.stage && event.message === next.message
}

function trim(events: TmwkHealthEvent[]): TmwkHealthEvent[] {
  let failures = events.filter((e) => e.type === 'failure').length - HEALTH_FAILURES_KEEP
  let rollovers = events.filter((e) => e.type === 'rollover').length - HEALTH_ROLLOVERS_KEEP
  return events.filter((event) => {
    if (event.type === 'failure' && failures > 0) {
      failures -= 1
      return false
    }
    if (event.type === 'rollover' && rollovers > 0) {
      rollovers -= 1
      return false
    }
    return true
  })
}

/** `store/health.json`: tmwk's own failures and rollovers, capped by type. */
export function createTmwkHealthStore(storeDir: string): TmwkHealthStore {
  const path = join(storeDir, 'health.json')
  const read = (): Promise<TmwkHealthEvent[]> => readStoreFile(path, 'events', isHealthEvent)
  const write = (events: TmwkHealthEvent[]): Promise<void> =>
    writeStoreFile(path, 'events', trim(events))
  return {
    list: () => serializeStoreWrite(path, read),
    addFailure: (failure) =>
      serializeStoreWrite(path, async () => {
        const events = await read()
        const index = events.findLastIndex((event) => event.type === 'failure')
        const last = events[index]
        if (last?.type === 'failure' && sameFailure(last, failure)) {
          const repeated = { ...last, at: failure.at, repeats: last.repeats + 1 }
          return write([...events.filter((_, i) => i !== index), repeated])
        }
        return write([...events, { type: 'failure', ...failure, repeats: 1 }])
      }),
    addRollover: (rollover) =>
      serializeStoreWrite(path, async () =>
        write([...(await read()), { type: 'rollover', ...rollover }])
      )
  }
}
