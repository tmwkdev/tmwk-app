import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDivergenceCheck } from './divergence-check.mjs'

const roots = []

function write(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

// A repo whose first commit is the upstream baseline, then a fork commit recording it in the map.
function forkRepo(mapRows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tmwk-divergence-'))
  roots.push(root)
  git(root, 'init', '-q')
  write(root, 'src/inherited/app.ts', 'upstream\n')
  write(root, 'src/inherited/app.test.ts', 'upstream\n')
  git(root, 'add', '-A')
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'upstream')
  const baseline = git(root, 'rev-parse', 'HEAD')
  write(
    root,
    'docs/tmwk/fork-ownership.md',
    [
      '# Fork ownership map',
      '',
      '## The map',
      '',
      '| Path | Strategy | Notes |',
      '| ---- | -------- | ----- |',
      ...mapRows,
      '| Everything else | Follow | |',
      '',
      '## Syncing with upstream',
      '',
      `Integrated upstream baseline: \`${baseline.slice(0, 12)}\` (test).`,
      ''
    ].join('\n')
  )
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('runDivergenceCheck', () => {
  it('fails an edited inherited file with no entry', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = forkRepo([])
    write(root, 'src/inherited/app.ts', 'tmwk\n')
    expect(runDivergenceCheck(root)).toBe(1)
    expect(errors.mock.calls.flat().join('\n')).toContain('M src/inherited/app.ts')
  })

  it('fails a deleted inherited file with no entry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = forkRepo(['| `src/inherited/app.ts` | Maintain | |'])
    fs.rmSync(path.join(root, 'src/inherited/app.test.ts'))
    expect(runDivergenceCheck(root)).toBe(1)
  })

  it('passes the same edit with a Maintain entry', () => {
    const root = forkRepo(['| `src/inherited/app.ts` | Maintain | |'])
    write(root, 'src/inherited/app.ts', 'tmwk\n')
    expect(runDivergenceCheck(root)).toBe(0)
  })

  it('passes edits covered by an Independent glob', () => {
    const root = forkRepo(['| `src/inherited/**` | Independent | |'])
    write(root, 'src/inherited/app.ts', 'tmwk\n')
    write(root, 'src/inherited/app.test.ts', 'tmwk\n')
    expect(runDivergenceCheck(root)).toBe(0)
  })

  it('does not count a Follow entry as recording divergence', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = forkRepo(['| `src/inherited/**` | Follow | |'])
    write(root, 'src/inherited/app.ts', 'tmwk\n')
    expect(runDivergenceCheck(root)).toBe(1)
  })

  it('ignores files tmwk added', () => {
    const root = forkRepo([])
    write(root, 'src/inherited/new-file.ts', 'tmwk\n')
    git(root, 'add', '-A')
    expect(runDivergenceCheck(root)).toBe(0)
  })
})
