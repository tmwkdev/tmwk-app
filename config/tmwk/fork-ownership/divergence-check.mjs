// Divergence check (fork-ownership "Guardrails"): an inherited path that differs from the integrated
// upstream baseline needs a Maintain or Independent entry in the map.
import { git, resolvesToCommit } from '../identity/identity-tripwire-diff.mjs'
import {
  integratedBaseline,
  OWNERSHIP_MAP,
  readOwnershipMap,
  strategyMatcher
} from './fork-ownership-map.mjs'

/** Inherited paths (present at the baseline) the working tree modified or deleted. */
function divergedInheritedPaths(root, baseline) {
  const entries = git(root, ['diff', '--no-renames', '--name-status', '-z', baseline, '--'])
    .split('\0')
    .filter(Boolean)
  const diverged = []
  for (let index = 0; index < entries.length; index += 2) {
    if (entries[index] !== 'A') {
      diverged.push({ status: entries[index], rel: entries[index + 1] })
    }
  }
  return diverged
}

export function runDivergenceCheck(root, argv = []) {
  if (argv.length > 0) {
    throw new Error(`takes no options, got ${argv.join(' ')}`)
  }
  const text = readOwnershipMap(root)
  const baseline = integratedBaseline(text)
  if (!resolvesToCommit(root, baseline)) {
    throw new Error(`baseline ${baseline} is not in this clone; fetch upstream history.`)
  }
  const recorded = strategyMatcher(text, ['Maintain', 'Independent'])
  const unrecorded = divergedInheritedPaths(root, baseline).filter(({ rel }) => !recorded(rel))
  if (unrecorded.length === 0) {
    return 0
  }
  console.error(
    `divergence check: ${unrecorded.length} inherited path(s) differ from upstream baseline ${baseline} with no Maintain or Independent entry:`
  )
  for (const { status, rel } of unrecorded) {
    console.error(`  ${status} ${rel}`)
  }
  console.error(
    `Add each to the map in ${OWNERSHIP_MAP} (and a Maintain patch-log line), or restore it.`
  )
  return 1
}
