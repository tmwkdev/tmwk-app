import { z } from 'zod'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import { tmwkError } from '../tmwk-error'

const queues = new Map<string, Promise<unknown>>()

// One in-process queue per file serializes read-modify-write.
export function serializeStoreWrite<T>(path: string, task: () => Promise<T>): Promise<T> {
  const run = (queues.get(path) ?? Promise.resolve()).then(task, task)
  queues.set(
    path,
    run.catch(() => undefined)
  )
  return run
}

/** The parsed file, or null when it does not exist; an unreadable file or invalid JSON is refused. */
async function readStoreJson(path: string): Promise<unknown> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw tmwkError('store_corrupt', `cannot read ${path}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw tmwkError('store_corrupt', `${path} is not valid JSON; fix or move it`)
  }
}

/** The file's `version`, or null when there is no file, so a store can migrate an older shape. */
export async function readStoreFileVersion(path: string): Promise<number | null> {
  const parsed = await readStoreJson(path)
  if (parsed === null) {
    return null
  }
  const shape = z.object({ version: z.number().int() }).safeParse(parsed)
  if (!shape.success) {
    throw tmwkError('store_corrupt', `${path} has an unknown shape or version; fix or move it`)
  }
  return shape.data.version
}

async function readStoreShape<T>(
  path: string,
  key: string,
  isItem: (value: unknown) => value is T,
  version: number
): Promise<{ items: T[]; counter: number }> {
  const parsed = await readStoreJson(path)
  if (parsed === null) {
    return { items: [], counter: 0 }
  }
  const shape = z
    .object({ version: z.literal(version), [key]: z.array(z.unknown()) })
    .safeParse(parsed)
  const items = shape.success ? shape.data[key] : null
  const counter = z.object({ counter: z.number().int().nonnegative() }).safeParse(parsed)
  if (!Array.isArray(items) || !items.every(isItem)) {
    throw tmwkError('store_corrupt', `${path} has an unknown shape or version; fix or move it`)
  }
  return { items, counter: counter.success ? counter.data.counter : 0 }
}

/** A missing file is empty; an unreadable, invalid or unknown-version file is refused and left alone. */
export async function readStoreFile<T>(
  path: string,
  key: string,
  isItem: (value: unknown) => value is T
): Promise<T[]> {
  return (await readStoreShape(path, key, isItem, 1)).items
}

/** Like readStoreFile, for a file that also keeps a top-level version counter. */
export function readCountedStoreFile<T>(
  path: string,
  key: string,
  isItem: (value: unknown) => value is T,
  version = 1
): Promise<{ items: T[]; counter: number }> {
  return readStoreShape(path, key, isItem, version)
}

export async function writeStoreFile<T>(
  path: string,
  key: string,
  items: T[],
  counter?: number,
  version = 1
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const document =
    counter === undefined ? { version, [key]: items } : { version, counter, [key]: items }
  writeFileAtomically(path, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 })
}
