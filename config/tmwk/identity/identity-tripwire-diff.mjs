// The tripwire's view of a diff: changed paths with renames, and the lines each one added.
import { execFileSync } from 'node:child_process'
import { listTrackedFiles } from '../../scripts/static-analysis/ratchet-baseline/ratchet-baseline.mjs'

/** Tracked plus untracked, unignored files, so a scratch file that was never added is still seen. */
export function scannableFiles(root, scanPathspecs) {
  const untracked = git(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    ...scanPathspecs
  ])
  return [...listTrackedFiles(root, scanPathspecs), ...untracked.split('\0').filter(Boolean)]
}

export function git(root, args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  })
}

export function resolvesToCommit(root, ref) {
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
    return true
  } catch {
    return false
  }
}

// Working tree against the merge base, so uncommitted and untracked edits count too.
export function changedFiles(root, base, { scanPathspecs, ownershipMap }) {
  const mergeBase = git(root, ['merge-base', base, 'HEAD']).trim()
  const entries = git(root, ['diff', '-M', '--name-status', '-z', mergeBase, '--'])
    .split('\0')
    .filter(Boolean)
  const renames = new Map()
  const changed = []
  for (let index = 0; index < entries.length;) {
    const status = entries[index++]
    const source = entries[index++]
    if (/^[RC]/.test(status)) {
      const target = entries[index++]
      renames.set(target, source)
      changed.push(target)
    } else if (status !== 'D') {
      changed.push(source)
    }
  }
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
  const inScope = new Set(scannableFiles(root, scanPathspecs))
  return {
    mergeBase,
    renames,
    mapChanged: [...changed, ...untracked].includes(ownershipMap),
    files: [...new Set([...changed, ...untracked])].filter((rel) => inScope.has(rel)).sort(),
    untracked: new Set(untracked)
  }
}

export function addedLines(root, changed, sources) {
  const added = new Map()
  const tracked = changed.files.filter((rel) => !changed.untracked.has(rel) && sources.has(rel))
  if (tracked.length > 0) {
    const pathspecs = [
      ...tracked,
      ...tracked.map((rel) => changed.renames.get(rel)).filter(Boolean)
    ]
    const diff = git(root, [
      'diff',
      '-M',
      '-U0',
      '--no-color',
      '--no-ext-diff',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      changed.mergeBase,
      '--',
      ...pathspecs
    ])
    let current = null
    let previous = ''
    let lineNumber = 0
    for (const line of diff.split('\n')) {
      if (line.startsWith('+++ ') && previous.startsWith('--- ')) {
        current = line.startsWith('+++ b/') ? line.slice(6) : null
        added.set(current, new Map())
      } else if (line.startsWith('@@')) {
        lineNumber = Number(/\+(\d+)/.exec(line)?.[1] ?? 0)
      } else if (current && line.startsWith('+')) {
        added.get(current).set(lineNumber++, line.slice(1))
      }
      previous = line
    }
  }
  for (const rel of changed.untracked) {
    if (sources.has(rel)) {
      added.set(
        rel,
        new Map(
          sources
            .get(rel)
            .split('\n')
            .map((line, index) => [index + 1, line])
        )
      )
    }
  }
  return added
}
