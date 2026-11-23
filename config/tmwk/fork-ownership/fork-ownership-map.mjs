// Reads docs/tmwk/fork-ownership.md: the map's path strategies and the integrated upstream baseline.
import fs from 'node:fs'
import path from 'node:path'

export const OWNERSHIP_MAP = 'docs/tmwk/fork-ownership.md'
const BASELINE_LINE = /^Integrated upstream baseline: `([0-9a-f]{7,40})`/m

export function readOwnershipMap(root) {
  return fs.readFileSync(path.join(root, OWNERSHIP_MAP), 'utf8')
}

function globToRegExp(glob) {
  const source = glob
    .replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')
  return new RegExp(`^${source}$`)
}

/** Each map row as { strategy, globs }; prose in a path cell ("Everything else", "(rest)") is ignored. */
export function parseMapRows(text) {
  const start = text.indexOf('\n## The map')
  if (start === -1) {
    throw new Error(`${OWNERSHIP_MAP} has no "## The map" section`)
  }
  const end = text.indexOf('\n## ', start + 1)
  const rows = []
  for (const row of text.slice(start, end === -1 ? undefined : end).split('\n')) {
    const cells = row.split('|').map((cell) => cell.trim())
    if (!['Follow', 'Maintain', 'Independent'].includes(cells[2])) {
      continue
    }
    const globs = [...cells[1].matchAll(/`([^`]+)`/g)].map(([, token]) => token)
    rows.push({ strategy: cells[2], globs })
  }
  return rows
}

/** True when some row with one of `strategies` lists the path or a glob covering it. */
export function strategyMatcher(text, strategies) {
  const patterns = parseMapRows(text)
    .filter((row) => strategies.includes(row.strategy))
    .flatMap((row) => row.globs.map(globToRegExp))
  return (rel) => patterns.some((pattern) => pattern.test(rel))
}

export function integratedBaseline(text) {
  const match = BASELINE_LINE.exec(text)
  if (!match) {
    throw new Error(`${OWNERSHIP_MAP} records no "Integrated upstream baseline: \`<commit>\`" line`)
  }
  return match[1]
}
