#!/usr/bin/env node

// tmwk's inverse of upstream's verify-telemetry-constants.mjs: a tmwk release must carry no Orca
// PostHog key and no Orca reporting endpoint (S22). Run it on `dist/` after packaging.
// Usage: node config/tmwk/release/verify-tmwk-no-telemetry.mjs [dist]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { isDirectInvocation } from '../../scripts/tool-invocation/script-entry-detection.mjs'
import {
  MINIFIED_TELEMETRY_RE,
  WRITE_KEY_RE
} from '../../scripts/desktop-build/telemetry-contracts/telemetry-bundle-constant-patterns.mjs'

// Any quoted PostHog project key, however the minifier names the constant holding it.
const ANY_POSTHOG_KEY_RE = /["'`]phc_[A-Za-z0-9_-]{8,}["'`]/
// The forbidden list belongs to tmwk's egress config point; JSON keeps it readable here without a TS loader.
const RELEASE_EGRESS_CHECK = JSON.parse(
  readFileSync(
    new URL('../../../src/shared/tmwk/identity/tmwk-release-egress-check.json', import.meta.url),
    'utf8'
  )
)

/** Returns one line per leak found in the joined `out/main` JavaScript. */
export function findOrcaTelemetryLeaks(mainJs) {
  const leaks = []
  const hasPostHogKey =
    WRITE_KEY_RE.test(mainJs) ||
    MINIFIED_TELEMETRY_RE.test(mainJs) ||
    ANY_POSTHOG_KEY_RE.test(mainJs)
  if (RELEASE_EGRESS_CHECK.forbidPostHogWriteKey && hasPostHogKey) {
    leaks.push('a PostHog write key (phc_…) is baked in')
  }
  for (const url of RELEASE_EGRESS_CHECK.forbiddenUrls) {
    if (mainJs.includes(url)) {
      leaks.push(`forbidden endpoint ${url} is baked in`)
    }
  }
  return leaks
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

/** Every `app.asar` under distDir must be free of Orca telemetry; returns the problems found. */
export function verifyTmwkNoTelemetry(distDir) {
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
    for (const leak of findOrcaTelemetryLeaks(mainJs)) {
      problems.push(`${asarPath}: ${leak}`)
    }
  }
  return problems
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  const distDir = process.argv[2] ?? 'dist'
  const problems = verifyTmwkNoTelemetry(distDir)
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`::error::${problem}`)
    }
    process.exit(1)
  }
  console.log(`No Orca telemetry key or reporting endpoint in ${distDir}.`)
}
