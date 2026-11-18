import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTmwkSummaryStore } from './tmwk-summary-store'

describe('tmwk summary store', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-summary-')), 'store')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('drops the oldest summary when a 21st is added', async () => {
    const store = createTmwkSummaryStore(storeDir)
    for (let i = 1; i <= 21; i++) {
      await store.add({ text: `summary ${i}`, sessionId: 's1', agent: 'claude', reason: 'manual' })
    }
    const all = await store.list()
    expect(all).toHaveLength(20)
    expect(all[0].text).toBe('summary 2')
    expect((await store.latest())?.text).toBe('summary 21')
  })

  it('refuses a corrupt file and leaves it unchanged', async () => {
    const store = createTmwkSummaryStore(storeDir)
    await mkdir(storeDir, { recursive: true })
    const path = join(storeDir, 'summary.json')
    await writeFile(path, '{"version":2,"summaries":[]}')
    await expect(
      store.add({ text: 'x', sessionId: 's1', agent: 'claude', reason: 'manual' })
    ).rejects.toThrow('tmwk_store_corrupt')
    expect(await readFile(path, 'utf-8')).toBe('{"version":2,"summaries":[]}')
  })
})
