import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeMainHomeTransports } from './ensure-main-home'
import { resolveMainHomePaths } from './main-home-paths'

describe('writeMainHomeTransports', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-home-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes both transports, skips unchanged content, rewrites changed content', async () => {
    const paths = resolveMainHomePaths({ TMWK_HOME: root })
    expect(await writeMainHomeTransports(paths, 'one\n')).toHaveLength(2)
    const before = (await stat(paths.claudeMd)).mtimeMs
    expect(await writeMainHomeTransports(paths, 'one\n')).toEqual([])
    expect((await stat(paths.claudeMd)).mtimeMs).toBe(before)
    expect(await writeMainHomeTransports(paths, 'two\n')).toHaveLength(2)
    expect(await readFile(paths.agentsMd, 'utf-8')).toBe('two\n')
    await writeFile(paths.claudeMd, 'edited')
    expect(await writeMainHomeTransports(paths, 'two\n')).toEqual([paths.claudeMd])
  })
})
