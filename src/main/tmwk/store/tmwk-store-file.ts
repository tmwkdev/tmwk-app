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

async function readStoreShape<T>(
  path: string,
  key: string,
  isItem: (value: unknown) => value is T
): Promise<{ items: T[]; counter: number }> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { items: [], counter: 0 }
    }
    throw tmwkError('store_corrupt', `cannot read ${path}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw tmwkError('store_corrupt', `${path} is not valid JSON; fix or move it`)
  }
  const shape = z.object({ version: z.literal(1), [key]: z.array(z.unknown()) }).safeParse(parsed)
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
  return (await readStoreShape(path, key, isItem)).items
}

/** Like readStoreFile, for a file that also keeps a top-level version counter. */
export function readCountedStoreFile<T>(
  path: string,
  key: string,
  isItem: (value: unknown) => value is T
): Promise<{ items: T[]; counter: number }> {
  return readStoreShape(path, key, isItem)
}

export async function writeStoreFile<T>(
  path: string,
  key: string,
  items: T[],
  counter?: number
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const document =
    counter === undefined ? { version: 1, [key]: items } : { version: 1, counter, [key]: items }
  writeFileAtomically(path, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 })
}
