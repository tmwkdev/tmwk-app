import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import {
  isTmwkSummary,
  TMWK_SUMMARY_MAX_CHARS,
  type TmwkSummary
} from '../../../shared/tmwk/tmwk-summaries'
import { tmwkError } from '../tmwk-error'
import { readStoreFile, serializeStoreWrite, writeStoreFile } from './tmwk-store-file'

export const TMWK_SUMMARY_KEEP = 20

export type NewTmwkSummary = Pick<TmwkSummary, 'text' | 'sessionId' | 'agent' | 'reason'> & {
  inputHash?: string | null
}

export type TmwkSummaryStore = {
  /** Oldest first. */
  list(): Promise<TmwkSummary[]>
  latest(): Promise<TmwkSummary | null>
  add(input: NewTmwkSummary): Promise<TmwkSummary>
}

function newSummaryId(taken: Set<string>): string {
  for (;;) {
    const id = `summary_${randomBytes(4).toString('hex')}`
    if (!taken.has(id)) {
      return id
    }
  }
}

export function createTmwkSummaryStore(storeDir: string): TmwkSummaryStore {
  const path = join(storeDir, 'summary.json')
  const read = (): Promise<TmwkSummary[]> => readStoreFile(path, 'summaries', isTmwkSummary)
  return {
    list: () => serializeStoreWrite(path, read),
    latest: () => serializeStoreWrite(path, async () => (await read()).at(-1) ?? null),
    add: (input) =>
      serializeStoreWrite(path, async () => {
        if (input.text.length > TMWK_SUMMARY_MAX_CHARS) {
          throw tmwkError(
            'text_too_long',
            `a summary is at most ${TMWK_SUMMARY_MAX_CHARS} characters`
          )
        }
        const summaries = await read()
        const summary: TmwkSummary = {
          id: newSummaryId(new Set(summaries.map((s) => s.id))),
          text: input.text,
          sessionId: input.sessionId,
          agent: input.agent,
          reason: input.reason,
          createdAt: new Date().toISOString(),
          inputHash: input.inputHash ?? null
        }
        await writeStoreFile(path, 'summaries', [...summaries, summary].slice(-TMWK_SUMMARY_KEEP))
        return summary
      })
  }
}
