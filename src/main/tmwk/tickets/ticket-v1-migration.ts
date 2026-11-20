import { constants } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { isTmwkTicket, type TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { readCountedStoreFile, writeStoreFile } from '../store/tmwk-store-file'

/** Rewrites a v1 snapshot file as tickets at `version`, keeping the original as `.v1.bak`. */
export async function migrateV1TicketFile(
  path: string,
  version: number,
  newId: (taken: ReadonlySet<string>) => string
): Promise<{ records: TmwkTicketRecord[]; counter: number }> {
  const { items, counter } = await readCountedStoreFile(path, 'tickets', isTmwkTicket, 1)
  const taken = new Set<string>()
  const records = items.map((snapshot) => {
    const id = newId(taken)
    taken.add(id)
    return ticketFromV1Snapshot(snapshot, id)
  })
  // Keep the first backup if a migration was interrupted after it.
  await copyFile(path, `${path}.v1.bak`, constants.COPYFILE_EXCL).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
  })
  await writeStoreFile(path, 'tickets', records, counter, version)
  return { records, counter }
}

/** One M3 snapshot becomes a ticket with one attempt; `changedAt` is kept so watermarks stay valid. */
export function ticketFromV1Snapshot(snapshot: TmwkTicket, id: string): TmwkTicketRecord {
  // v1 never held `requested`; a hand-edited one reads as pending.
  const status = snapshot.status === 'requested' ? 'pending' : snapshot.status
  const finished = status === 'completed' || status === 'failed'
  return {
    id,
    title: snapshot.title,
    words: '',
    status: snapshot.acceptedAt === null ? 'active' : 'accepted',
    origin: 'orca',
    attempts: [
      {
        runId: snapshot.runId,
        taskId: snapshot.taskId,
        startedAt: snapshot.firstSeenAt,
        ...(finished
          ? {
              settledAt: snapshot.completedAt ?? snapshot.lastSeenAt,
              outcome: status === 'completed' ? ('completed' as const) : ('failed' as const)
            }
          : {}),
        observed: {
          title: snapshot.title,
          status,
          result: snapshot.result,
          completedAt: snapshot.completedAt,
          question: snapshot.question,
          owner: snapshot.owner,
          firstSeenAt: snapshot.firstSeenAt,
          lastSeenAt: snapshot.lastSeenAt
        }
      }
    ],
    history: [
      {
        at: snapshot.firstSeenAt,
        kind: 'migrated',
        text: 'Kept from the M3 ticket snapshot',
        taskId: snapshot.taskId
      }
    ],
    ...(snapshot.acceptedAt === null ? {} : { acceptedAt: snapshot.acceptedAt }),
    createdAt: snapshot.firstSeenAt,
    changedAt: snapshot.changedAt
  }
}
