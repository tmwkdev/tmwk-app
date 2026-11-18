import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTmwkRecordStore, isRecordInEffect } from './tmwk-record-store'

describe('tmwk record store', () => {
  let storeDir: string
  beforeEach(async () => {
    storeDir = join(await mkdtemp(join(tmpdir(), 'tmwk-store-')), 'store')
  })
  afterEach(async () => {
    await rm(join(storeDir, '..'), { recursive: true, force: true })
  })

  it('supersedes a preference, keeps history and refuses a second replace', async () => {
    const store = createTmwkRecordStore(storeDir)
    const first = await store.add({ kind: 'preference', text: 'Use npm.', project: null })
    const second = await store.add({
      kind: 'preference',
      text: 'Use pnpm.',
      project: null,
      supersedes: first.record.id
    })
    expect(second.superseded).toEqual([first.record.id])

    const all = await store.list('preference')
    expect(all.filter(isRecordInEffect).map((r) => r.text)).toEqual(['Use pnpm.'])
    expect(all.map((r) => r.text)).toEqual(['Use npm.', 'Use pnpm.'])
    expect(all[0].supersededBy).toBe(second.record.id)

    await expect(
      store.add({
        kind: 'preference',
        text: 'Use yarn.',
        project: null,
        supersedes: first.record.id
      })
    ).rejects.toThrow('tmwk_record_not_effective')
    await expect(store.retire(first.record.id, 'preference')).rejects.toThrow(
      'tmwk_record_not_effective'
    )
  })

  it('rejects text over the preference limit', async () => {
    const store = createTmwkRecordStore(storeDir)
    await expect(
      store.add({ kind: 'preference', text: 'x'.repeat(301), project: null })
    ).rejects.toThrow('tmwk_text_too_long')
  })

  it('never overwrites a corrupt records.json', async () => {
    await mkdir(storeDir, { recursive: true })
    const path = join(storeDir, 'records.json')
    await writeFile(path, '{not json')
    const store = createTmwkRecordStore(storeDir)
    await expect(store.add({ kind: 'preference', text: 'Hi.', project: null })).rejects.toThrow(
      'tmwk_store_corrupt'
    )
    await expect(store.list('preference')).rejects.toThrow('tmwk_store_corrupt')
    expect(await readFile(path, 'utf-8')).toBe('{not json')
  })
})
