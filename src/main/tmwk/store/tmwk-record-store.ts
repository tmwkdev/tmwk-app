import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import {
  isTmwkRecord,
  type TmwkRecord,
  type TmwkRecordKind
} from '../../../shared/tmwk/tmwk-records'
import { tmwkError } from '../tmwk-error'
import { readStoreFile, serializeStoreWrite, writeStoreFile } from './tmwk-store-file'

export const TMWK_TEXT_LIMITS: Record<TmwkRecordKind, number> = { preference: 300, note: 1000 }

const ID_PREFIX: Record<TmwkRecordKind, string> = { preference: 'pref_', note: 'note_' }

export type NewTmwkRecord = {
  kind: TmwkRecordKind
  text: string
  project: TmwkRecord['project']
  source?: string | null
  supersedes?: string | null
}

export function isRecordInEffect(record: TmwkRecord): boolean {
  return record.supersededBy === null && record.retiredAt === null
}

const readRecords = (path: string): Promise<TmwkRecord[]> =>
  readStoreFile(path, 'records', isTmwkRecord)

const writeRecords = (path: string, records: TmwkRecord[]): Promise<void> =>
  writeStoreFile(path, 'records', records)

function newRecordId(kind: TmwkRecordKind, taken: Set<string>): string {
  for (;;) {
    const id = `${ID_PREFIX[kind]}${randomBytes(4).toString('hex')}`
    if (!taken.has(id)) {
      return id
    }
  }
}

function requireInEffect(records: TmwkRecord[], id: string, kind: TmwkRecordKind): TmwkRecord {
  const found = records.find((record) => record.id === id && record.kind === kind)
  if (!found || !isRecordInEffect(found)) {
    throw tmwkError('record_not_effective', `${id} is not a ${kind} in effect`)
  }
  return found
}

export type TmwkRecordStore = {
  list(kind: TmwkRecordKind): Promise<TmwkRecord[]>
  listAll(): Promise<TmwkRecord[]>
  add(input: NewTmwkRecord): Promise<{ record: TmwkRecord; superseded: string[] }>
  retire(id: string, kind: TmwkRecordKind): Promise<TmwkRecord>
}

export function createTmwkRecordStore(storeDir: string): TmwkRecordStore {
  const path = join(storeDir, 'records.json')
  return {
    list: (kind) =>
      serializeStoreWrite(path, async () =>
        (await readRecords(path)).filter((record) => record.kind === kind)
      ),
    listAll: () => serializeStoreWrite(path, () => readRecords(path)),
    add: (input) =>
      serializeStoreWrite(path, async () => {
        if (input.text.length > TMWK_TEXT_LIMITS[input.kind]) {
          throw tmwkError(
            'text_too_long',
            `a ${input.kind} is at most ${TMWK_TEXT_LIMITS[input.kind]} characters`
          )
        }
        const records = await readRecords(path)
        const supersedes = input.supersedes ?? null
        const old = supersedes === null ? null : requireInEffect(records, supersedes, input.kind)
        const record: TmwkRecord = {
          id: newRecordId(input.kind, new Set(records.map((r) => r.id))),
          kind: input.kind,
          text: input.text,
          project: input.project,
          source: input.source ?? null,
          createdAt: new Date().toISOString(),
          supersedes,
          supersededBy: null,
          retiredAt: null
        }
        const next = records.map((r) => (r === old ? { ...r, supersededBy: record.id } : r))
        await writeRecords(path, [...next, record])
        return { record, superseded: supersedes === null ? [] : [supersedes] }
      }),
    retire: (id, kind) =>
      serializeStoreWrite(path, async () => {
        const records = await readRecords(path)
        const target = requireInEffect(records, id, kind)
        const retired = { ...target, retiredAt: new Date().toISOString() }
        await writeRecords(
          path,
          records.map((r) => (r === target ? retired : r))
        )
        return retired
      })
  }
}
