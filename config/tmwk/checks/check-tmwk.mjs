#!/usr/bin/env node
// `pnpm check:tmwk`: the fork's own checks behind one command (code-quality-plan §2.3, P1.1).
// Default: scoped to files changed since the merge base. --full: the whole tree (nightly).
// --<check> [flags]: one check with its own flags, e.g. --identity --update.
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { isDirectInvocation } from '../../scripts/tool-invocation/script-entry-detection.mjs'

// One entry per check. `changed` and `full` build its argv; `flag` runs it alone.
const CHECKS = [
  {
    name: 'identity tripwire',
    flag: '--identity',
    module: 'config/tmwk/identity/identity-tripwire.mjs',
    entry: 'runIdentityTripwire',
    changed: ({ mergeBase }) => ['--diff', mergeBase],
    full: ({ json }) => (json ? ['--json', json] : [])
  }
]

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

// Same base rules as check:changed, which exports its merge base as ORCA_CODE_QUALITY_BASE.
function resolveMergeBase(root, requested) {
  for (const candidate of [requested, process.env.ORCA_CODE_QUALITY_BASE, 'origin/main', 'main']) {
    if (!candidate) {
      continue
    }
    const verified = spawnSync(
      'git',
      ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`],
      { cwd: root, stdio: 'ignore' }
    )
    if (verified.status === 0) {
      return { ref: candidate, mergeBase: git(root, ['merge-base', candidate, 'HEAD']) }
    }
    if (candidate === requested) {
      throw new Error(`--base=${requested} does not resolve to a commit.`)
    }
  }
  throw new Error('No base: fetch origin/main or pass --base=<ref>.')
}

function parseArgs(argv) {
  const single = CHECKS.find((check) => check.flag === argv[0])
  if (single) {
    return { single, rest: argv.slice(1) }
  }
  const options = { mode: 'changed', base: null, json: null }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--full') {
      options.mode = 'full'
    } else if (argument.startsWith('--base=')) {
      options.base = argument.slice('--base='.length)
    } else if (argument === '--json' && argv[index + 1]) {
      options.json = path.resolve(argv[++index])
    } else if (argument !== '--') {
      throw new Error(
        `unknown option ${argument}. Use --full [--json <file>], --base=<ref>, or ${CHECKS.map((check) => check.flag).join(', ')} [flags].`
      )
    }
  }
  return options
}

async function runCheck(root, check, argv) {
  const startedAt = performance.now()
  let code
  try {
    const loaded = await import(pathToFileURL(path.join(root, check.module)).href)
    code = await loaded[check.entry](root, argv)
  } catch (error) {
    console.error(`${check.name}: ${error.message ?? error}`)
    code = 2
  }
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
  console.log(`${code === 0 ? '✓' : '✗'} ${check.name} (${seconds}s)`)
  return code
}

export async function main(root, argv) {
  const options = parseArgs(argv)
  if (options.single) {
    return runCheck(root, options.single, options.rest)
  }
  const context = { json: options.json }
  if (options.mode === 'changed') {
    const { ref, mergeBase } = resolveMergeBase(root, options.base)
    context.mergeBase = mergeBase
    console.log(`check:tmwk: changes since ${ref} (${mergeBase.slice(0, 10)}).`)
  }
  const codes = []
  for (const check of CHECKS) {
    codes.push(await runCheck(root, check, check[options.mode](context)))
  }
  return Math.max(0, ...codes)
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  try {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel'])
    process.exitCode = await main(root, process.argv.slice(2))
  } catch (error) {
    console.error(`check:tmwk: ${error.message ?? error}`)
    process.exitCode = 2
  }
}
