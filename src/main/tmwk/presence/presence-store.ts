import { readFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import { tmwkError } from '../tmwk-error'
import { serializeStoreWrite } from '../store/tmwk-store-file'
import type { PresenceState } from './presence-state'

const PresenceFile = z.object({
  version: z.literal(1),
  lastPresentAt: z.string().nullable(),
  awaySince: z.string().nullable(),
  digestVersion: z.number().int().nonnegative()
})

export type PresenceStore = {
  /** Applies `change` to the stored state under the write queue; `initialDigestVersion` seeds a missing file. */
  update<T>(
    initialDigestVersion: () => Promise<number>,
    change: (state: PresenceState) => { state: PresenceState; result: T }
  ): Promise<T>
  read(): Promise<PresenceState | null>
}

export function createPresenceStore(storeDir: string): PresenceStore {
  const path = join(storeDir, 'presence.json')
  const read = async (): Promise<PresenceState | null> => {
    let raw: string
    try {
      raw = await readFile(path, 'utf-8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null
      }
      throw tmwkError('store_corrupt', `cannot read ${path}`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw tmwkError('store_corrupt', `${path} is not valid JSON; fix or move it`)
    }
    const file = PresenceFile.safeParse(parsed)
    if (!file.success) {
      throw tmwkError('store_corrupt', `${path} has an unknown shape or version; fix or move it`)
    }
    const { lastPresentAt, awaySince, digestVersion } = file.data
    return { lastPresentAt, awaySince, digestVersion }
  }
  return {
    read: () => serializeStoreWrite(path, read),
    update: (initialDigestVersion, change) =>
      serializeStoreWrite(path, async () => {
        const current = (await read()) ?? {
          lastPresentAt: null,
          awaySince: null,
          digestVersion: await initialDigestVersion()
        }
        const { state, result } = change(current)
        await mkdir(dirname(path), { recursive: true, mode: 0o700 })
        writeFileAtomically(path, `${JSON.stringify({ version: 1, ...state }, null, 2)}\n`, {
          mode: 0o600
        })
        return result
      })
  }
}
