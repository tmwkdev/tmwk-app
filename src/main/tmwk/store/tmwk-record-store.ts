import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import {
  isTmwkRecord,
  type TmwkRecord,
  type TmwkRecordKind
} from '../../../shared/tmwk/tmwk-records'
import { tmwkError } from '../tmwk-error'

export const TMWK_TEXT_LIMITS: Record<TmwkRecordKind, number> = { preference: 300, note: 1000 }

const ID_PREFIX: Record<TmwkRecordKind, string> = { preference: 'pref_', note: 'note_' }

export type NewTmwkRecord = {
  kind: TmwkRecordKind
  text: string
  project: TmwkRecord['project']
  source?: string | null
  supersedes?: string | null
}

const queues = new Map<string, Promise<unknown>>()

// One in-process queue per file serializes read-modify-write.
function serialize<T>(path: string, task: () => T): Promise<T> {
  const run = (queues.get(path) ?? Promise.resolve()).then(task, task)
  queues.set(
    path,
    run.catch(() => undefined)
  )
  return run
}

export function isRecordInEffect(record: TmwkRecord): boolean {
  return record.supersededBy === null && record.retiredAt === null
}

function readRecords(path: string): TmwkRecord[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw tmwkError('store_corrupt', `cannot read ${path}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw tmwkError('store_corrupt', `${path} is not valid JSON; fix or move it`)
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    parsed.version !== 1 ||
    !('records' in parsed) ||
    !Array.isArray(parsed.records) ||
    !parsed.records.every(isTmwkRecord)
  ) {
    throw tmwkError('store_corrupt', `${path} has an unknown shape or version; fix or move it`)
  }
  return parsed.records
}

function writeRecords(storeDir: string, path: string, records: TmwkRecord[]): void {
  mkdirSync(storeDir, { recursive: true, mode: 0o700 })
  writeFileAtomically(path, `${JSON.stringify({ version: 1, records }, null, 2)}\n`, {
    mode: 0o600
  })
}

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
  add(input: NewTmwkRecord): Promise<{ record: TmwkRecord; superseded: string[] }>
  retire(id: string, kind: TmwkRecordKind): Promise<TmwkRecord>
}

export function createTmwkRecordStore(storeDir: string): TmwkRecordStore {
  const path = join(storeDir, 'records.json')
  return {
    list: (kind) =>
      serialize(path, () => readRecords(path).filter((record) => record.kind === kind)),
    add: (input) =>
      serialize(path, () => {
        if (input.text.length > TMWK_TEXT_LIMITS[input.kind]) {
          throw tmwkError(
            'text_too_long',
            `a ${input.kind} is at most ${TMWK_TEXT_LIMITS[input.kind]} characters`
          )
        }
        const records = readRecords(path)
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
        writeRecords(storeDir, path, [...next, record])
        return { record, superseded: supersedes === null ? [] : [supersedes] }
      }),
    retire: (id, kind) =>
      serialize(path, () => {
        const records = readRecords(path)
        const target = requireInEffect(records, id, kind)
        const retired = { ...target, retiredAt: new Date().toISOString() }
        writeRecords(
          storeDir,
          path,
          records.map((r) => (r === target ? retired : r))
        )
        return retired
      })
  }
}
