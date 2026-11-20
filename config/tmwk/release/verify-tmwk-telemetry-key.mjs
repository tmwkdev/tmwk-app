#!/usr/bin/env node

// The key is tmwk's: every release must bake in exactly tmwk's PostHog write key (matched by hash)
// and no Orca reporting endpoint (S22). Run it on `dist/` after packaging.
// Usage: node config/tmwk/release/verify-tmwk-telemetry-key.mjs [dist]

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { isDirectInvocation } from '../../scripts/tool-invocation/script-entry-detection.mjs'

// Any quoted PostHog project key, however the minifier names the constant holding it.
const ANY_POSTHOG_KEY_RE = /["'`](phc_[A-Za-z0-9_-]{8,})["'`]/g
// The forbidden list belongs to tmwk's egress config point; JSON keeps it readable here without a TS loader.
const RELEASE_EGRESS_CHECK = JSON.parse(
  readFileSync(
    new URL('../../../src/shared/tmwk/identity/tmwk-release-egress-check.json', import.meta.url),
    'utf8'
  )
)

/** Returns one line per problem found in the joined `out/main` JavaScript; never prints a key. */
export function findTelemetryKeyProblems(mainJs, expectedSha256) {
  const problems = []
  const keys = new Set([...mainJs.matchAll(ANY_POSTHOG_KEY_RE)].map((match) => match[1]))
  if (keys.size === 0) {
    problems.push("no PostHog write key baked in; a release must carry tmwk's")
  }
  for (const key of keys) {
    const digest = createHash('sha256').update(key).digest('hex')
    if (digest !== expectedSha256) {
      problems.push(
        `a PostHog write key that is not tmwk's is baked in (sha256 ${digest.slice(0, 8)}…)`
      )
    }
  }
  for (const url of RELEASE_EGRESS_CHECK.forbiddenUrls) {
    if (mainJs.includes(url)) {
      problems.push(`forbidden endpoint ${url} is baked in`)
    }
  }
  return problems
}

function findAsars(rootDir) {
  const matches = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile() && entry.name === 'app.asar') {
        matches.push(fullPath)
      }
    }
  }
  return matches
}

function readMainJs(asarPath) {
  return listPackage(asarPath)
    .map((entry) => entry.replace(/\\/g, '/').replace(/^\/+/, ''))
    .filter((entry) => entry.startsWith('out/main/') && entry.endsWith('.js'))
    .map((entry) => extractFile(asarPath, entry).toString('utf8'))
    .join('\n')
}

/** Every `app.asar` under distDir must carry tmwk's key and no Orca endpoint; returns the problems found. */
export function verifyTmwkTelemetryKey(distDir) {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    return [`dist directory not found at ${distDir}`]
  }
  const asars = findAsars(distDir)
  if (asars.length === 0) {
    return [`no app.asar under ${distDir}`]
  }
  const problems = []
  for (const asarPath of asars) {
    const mainJs = readMainJs(asarPath)
    if (mainJs.length === 0) {
      problems.push(`${asarPath}: no out/main JavaScript to check`)
      continue
    }
    for (const problem of findTelemetryKeyProblems(
      mainJs,
      RELEASE_EGRESS_CHECK.posthogWriteKeySha256
    )) {
      problems.push(`${asarPath}: ${problem}`)
    }
  }
  return problems
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  const distDir = process.argv[2] ?? 'dist'
  const problems = verifyTmwkTelemetryKey(distDir)
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`::error::${problem}`)
    }
    process.exit(1)
  }
  console.log(`tmwk's PostHog key, and no Orca reporting endpoint, in ${distDir}.`)
}
