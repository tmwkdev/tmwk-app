import { join } from 'node:path'
import { z } from 'zod'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { readStoreFile, serializeStoreWrite, writeStoreFile } from '../store/tmwk-store-file'

export const REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000

const isMark = (value: unknown): value is { lastReportedAt: number } =>
  z.object({ lastReportedAt: z.number() }).safeParse(value).success

const markPath = (): string => join(resolveMainHomePaths().storeDir, 'telemetry.json')

/** `store/telemetry.json`: when count events were last enqueued; null before the first report. */
export async function readLastReportedAt(): Promise<number | null> {
  const [mark] = await serializeStoreWrite(markPath(), () =>
    readStoreFile(markPath(), 'marks', isMark)
  )
  return mark?.lastReportedAt ?? null
}

export function writeLastReportedAt(at: number): Promise<void> {
  return serializeStoreWrite(markPath(), () =>
    writeStoreFile(markPath(), 'marks', [{ lastReportedAt: at }])
  )
}
