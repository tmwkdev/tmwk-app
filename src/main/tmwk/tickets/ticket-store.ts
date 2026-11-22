import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import {
  isTmwkTicketRecord,
  type TmwkTicketAttempt,
  type TmwkTicketEvent,
  type TmwkTicketRecord,
  type TmwkTicketShow,
  type TmwkTicketSource
} from '../../../shared/tmwk/tmwk-ticket-record'
import { tmwkError } from '../tmwk-error'
import {
  readCountedStoreFile,
  readStoreFileVersion,
  serializeStoreWrite,
  writeStoreFile
} from '../store/tmwk-store-file'
import { findTicket, isOpenAttempt, listTicket } from './ticket-listing'
import { mergeLiveTasks, type LiveTicket } from './merge-live-tasks'
import { attemptsToFollow, type AttemptFacts, type FollowedAttempt } from './attempt-facts'
import type { TaskDispatch } from './read-task-dispatches'
import { migrateV1TicketFile } from './ticket-v1-migration'
import { attemptEvents, type TicketAttemptInput } from './ticket-attempt-events'
import { contentKey, observableKey } from './ticket-change-keys'
import { acceptRecord, withoutAcceptance } from './ticket-acceptance'

export type { LiveTicket } from './merge-live-tasks'
export type { TicketAttemptInput } from './ticket-attempt-events'

export type TicketChange = { ticket: TmwkTicketListing; previous: TmwkTicketListing | null }

export type TicketList = { version: number; tickets: TmwkTicketListing[] }

export type TicketShow = TmwkTicketShow

export type TicketCreateInput = {
  words: string
  title?: string
  goal?: string
  projectId?: string
  kind?: 'ongoing'
  runOn?: string
  agent?: string
  source?: TmwkTicketSource
}

export type TicketStore = {
  /**
   * Folds the live Tasks of Run `main` into the tickets; only tickets whose listed fields changed
   * move to a new version. Open attempts in `unreadRunIds` keep their last observation. `facts`
   * are what the caller read for `followed()`, by dispatch id.
   */
  refresh(
    live: LiveTicket[],
    options?: {
      unreadRunIds?: readonly string[]
      facts?: ReadonlyMap<string, AttemptFacts>
      dispatches?: ReadonlyMap<string, TaskDispatch>
    }
  ): Promise<{ version: number; changes: TicketChange[] }>
  /** The attempts whose launch, branch or PR a refresh should read from Orca. */
  followed(): Promise<FollowedAttempt[]>
  /** Accepts the ticket and marks its attempts' worktrees for cleanup. */
  accept(idOrTaskId: string): Promise<TicketChange>
  /** Replaces one ticket at the same version: a change no listing shows (worktree cleanup). */
  amend(id: string, change: (record: TmwkTicketRecord) => TmwkTicketRecord): Promise<void>
  list(filter?: { needsMe?: boolean; since?: number }): Promise<TicketList>
  /** Every record with its attempts, for the overview's fleet join. */
  records(): Promise<{ version: number; records: TmwkTicketRecord[] }>
  /** A new `requested` ticket, or with `reuse` the given ticket revised for its next attempt. */
  create(input: TicketCreateInput, options?: { reuse?: string }): Promise<TicketShow>
  attach(idOrTaskId: string, attempt: TicketAttemptInput): Promise<TicketShow>
  ask(idOrTaskId: string, question: { text: string; recommend?: string }): Promise<TicketShow>
  show(idOrTaskId: string): Promise<TicketShow>
  /** Replaces one ticket with `change`'s result at a new version (W5's answers and messages). */
  revise(
    idOrTaskId: string,
    change: (record: TmwkTicketRecord, now: string) => TmwkTicketRecord
  ): Promise<TicketShow>
}

const STORE_VERSION = 2
const TITLE_MAX = 120

function newTicketId(taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `tk_${randomBytes(4).toString('hex')}`
    if (!taken.has(id)) {
      return id
    }
  }
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0].slice(0, TITLE_MAX)
}

export function createTicketStore(storeDir: string): TicketStore {
  const path = join(storeDir, 'tickets.json')

  const read = async (): Promise<{ records: TmwkTicketRecord[]; counter: number }> => {
    if ((await readStoreFileVersion(path)) === 1) {
      return migrateV1TicketFile(path, STORE_VERSION, newTicketId)
    }
    const { items, counter } = await readCountedStoreFile(
      path,
      'tickets',
      isTmwkTicketRecord,
      STORE_VERSION
    )
    return { records: items, counter }
  }

  const write = (records: TmwkTicketRecord[], counter: number) =>
    writeStoreFile(path, 'tickets', records, counter, STORE_VERSION)

  /** Replaces one ticket at a new version; `drop` removes other tickets in the same write. */
  const update = (
    idOrTaskId: string,
    change: (record: TmwkTicketRecord, now: string) => TmwkTicketRecord,
    drop: (record: TmwkTicketRecord, next: TmwkTicketRecord) => boolean = () => false
  ): Promise<TicketShow> =>
    serializeStoreWrite(path, async () => {
      const { records, counter } = await read()
      const previous = findTicket(records, idOrTaskId)
      const version = counter + 1
      const next = { ...change(previous, new Date().toISOString()), changedAt: version }
      await write(
        records.flatMap((record) =>
          record.id === previous.id ? [next] : drop(record, next) ? [] : [record]
        ),
        version
      )
      return { version, ticket: next, listing: listTicket(next) }
    })

  return {
    refresh: (live, { unreadRunIds = [], facts, dispatches } = {}) =>
      serializeStoreWrite(path, async () => {
        const { records, counter: start } = await read()
        let counter = start
        const taken = new Set(records.map((record) => record.id))
        const merged = mergeLiveTasks(records, live, {
          unreadRunIds,
          facts,
          dispatches,
          now: new Date().toISOString(),
          newId: () => {
            const id = newTicketId(taken)
            taken.add(id)
            return id
          }
        })
        const before = new Map(records.map((record) => [record.id, record]))
        const changes: TicketChange[] = []
        let dirty = merged.length !== records.length
        const next = merged.map((record) => {
          const old = before.get(record.id)
          if (old && contentKey(old) === contentKey(record)) {
            return old
          }
          dirty = true
          const previous = old ? listTicket(old) : null
          const listing = listTicket(record)
          if (previous !== null && observableKey(previous) === observableKey(listing)) {
            return record
          }
          const changed = { ...record, changedAt: ++counter }
          changes.push({ ticket: listTicket(changed), previous })
          return changed
        })
        if (dirty) {
          await write(next, counter)
        }
        return { version: counter, changes }
      }),

    followed: () =>
      serializeStoreWrite(path, async () => attemptsToFollow((await read()).records, Date.now())),

    accept: (idOrTaskId) =>
      serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        const previous = findTicket(records, idOrTaskId)
        if (previous.acceptedAt !== undefined) {
          const listing = listTicket(previous)
          return { ticket: listing, previous: listing }
        }
        const ticket = {
          ...acceptRecord(previous, new Date().toISOString()),
          changedAt: counter + 1
        }
        await write(
          records.map((record) => (record.id === previous.id ? ticket : record)),
          counter + 1
        )
        return { ticket: listTicket(ticket), previous: listTicket(previous) }
      }),

    amend: (id, change) =>
      serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        await write(
          records.map((record) => (record.id === id ? change(record) : record)),
          counter
        )
      }),

    list: (filter = {}) =>
      serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        const since = filter.since
        return {
          version: counter,
          tickets: records
            .map(listTicket)
            .filter(
              (ticket) =>
                (!filter.needsMe || ticket.needsMe !== null) &&
                (since === undefined || ticket.changedAt > since)
            )
        }
      }),

    records: () =>
      serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        return { version: counter, records }
      }),

    create: (input, { reuse } = {}) => {
      const fields = {
        ...(input.goal ? { goal: input.goal } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.runOn ? { runOn: input.runOn } : {}),
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.source ? { source: input.source } : {})
      }
      if (reuse !== undefined) {
        return update(reuse, (record) => {
          if (isOpenAttempt(record.attempts.at(-1))) {
            throw tmwkError(
              'ticket_running',
              `${record.id} has a running attempt; message its owner instead`
            )
          }
          return {
            ...record,
            ...fields,
            ...(input.title ? { title: input.title } : {}),
            ...(input.words && !record.words ? { words: input.words } : {})
          }
        })
      }
      return serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        const now = new Date().toISOString()
        const version = counter + 1
        const ticket: TmwkTicketRecord = {
          id: newTicketId(new Set(records.map((record) => record.id))),
          title: input.title || firstLine(input.words),
          words: input.words,
          ...fields,
          status: 'requested',
          origin: 'tmwk',
          attempts: [],
          history: [{ at: now, kind: 'requested', text: input.words }],
          createdAt: now,
          changedAt: version
        }
        await write([...records, ticket], version)
        return { version, ticket, listing: listTicket(ticket) }
      })
    },

    attach: (idOrTaskId, input) =>
      update(
        idOrTaskId,
        (record, now) => {
          const { failedStart, briefId: _briefId, source, ...fields } = input
          const agent = fields.agent ?? record.agent
          const attempt: TmwkTicketAttempt = {
            ...fields,
            ...(agent ? { agent } : {}),
            startedAt: now,
            ...(failedStart ? { settledAt: now, outcome: 'failed_start' as const } : {})
          }
          const closed: TmwkTicketEvent[] = record.question
            ? [
                {
                  at: now,
                  kind: 'question-closed',
                  text: 'Closed by the next attempt',
                  questionId: record.question.id
                }
              ]
            : []
          const { question: _question, ...rest } = withoutAcceptance(record)
          return {
            ...rest,
            ...(record.source === undefined && source ? { source } : {}),
            status: 'active',
            attempts: [...record.attempts, attempt],
            history: [...record.history, ...closed, ...attemptEvents(attempt, input, now)]
          }
        },
        // A refresh between taskCreate and attach already listed the Task as its own ticket.
        (record) =>
          input.taskId !== undefined &&
          record.origin === 'orca' &&
          record.attempts.length === 1 &&
          record.attempts[0].taskId === input.taskId
      ),

    ask: (idOrTaskId, { text, recommend }) =>
      update(idOrTaskId, (record, now) => {
        const id = `q_${randomBytes(4).toString('hex')}`
        return {
          ...record,
          question: { id, text, ...(recommend ? { recommend } : {}), askedAt: now },
          history: [...record.history, { at: now, kind: 'asked', text, questionId: id }]
        }
      }),

    show: (idOrTaskId) =>
      serializeStoreWrite(path, async () => {
        const { records, counter } = await read()
        const ticket = findTicket(records, idOrTaskId)
        return { version: counter, ticket, listing: listTicket(ticket) }
      }),

    revise: update
  }
}
