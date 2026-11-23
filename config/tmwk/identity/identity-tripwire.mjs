#!/usr/bin/env node
// Identity tripwire (identity-egress-guide "The tripwire"): fails on a new upstream identity or egress
// literal outside Independent paths; shrinkage is progress, never a failure.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  diffCounts,
  diffEntries,
  formatCountBaseline,
  parseCountBaseline,
  parseCountNotes,
  parseEntryBaseline
} from '../../scripts/static-analysis/ratchet-baseline/ratchet-baseline.mjs'
import { isDirectInvocation } from '../../scripts/tool-invocation/script-entry-detection.mjs'
import {
  addedLines,
  changedFiles,
  git,
  resolvesToCommit,
  scannableFiles
} from './identity-tripwire-diff.mjs'

const BASELINE_DIR = 'config/tmwk/identity/baseline'
const IDENTITY_DIR = 'src/shared/tmwk/identity'
const OWNERSHIP_MAP = 'docs/tmwk/fork-ownership.md'
const BRANDING_DIR = 'src/shared/tmwk/branding'
const SCAN_PATHSPECS = [
  'src',
  'resources',
  'config',
  'native',
  'skills',
  'electron.vite.config.ts',
  ':(glob)vite.*.config.ts',
  'package.json'
]
// Locale catalogs are copy; CI metadata is like .github/** (Actions is off) and churns every sync.
const SKIPPED =
  /(?:^|\/)(?:tmwk|main-chat|__tests__|__mocks__|tests?|(?:__)?fixtures?(?:__)?)\/|\.(?:test|spec|fixture|test-fixture)\.|^src\/renderer\/src\/i18n\/locales\/|^config\/(?:scripts\/ci\/|reliability-gates\.jsonc$)/
const BINARY =
  /\.(?:png|jpe?g|gif|webp|ico|icns|bmp|tiff?|mp3|wav|ogg|m4a|mp4|mov|woff2?|ttf|otf|eot|zip|gz|tgz|xz|bz2|tar|dmg|exe|dll|so|dylib|node|wasm|pdf|car|a|o|bin)$/i
const SLASH_COMMENTED = /\.(?:[cm]?[jt]sx?|jsonc|swift|rs|c|cc|cpp|h|hpp|m|mm|go|css|scss)$/
const HASH_COMMENTED = /\.(?:sh|bash|zsh|ya?ml|py|ps1|toml|rb|nsh)$/
const DIFF_SCOPE = { scanPathspecs: SCAN_PATHSPECS, ownershipMap: OWNERSHIP_MAP }
const DEFAULT_REASON = 'fine: upstream as of fork point, untriaged'

const readJson = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const alternation = (values) => values.map(escape).join('|')

function categories(root) {
  const orcaHosts = readJson(root, `${IDENTITY_DIR}/tmwk-orca-hosts.json`)
  const { forbiddenUrls } = readJson(root, `${IDENTITY_DIR}/tmwk-release-egress-check.json`)
  const keyEnv = readJson(root, `${IDENTITY_DIR}/tmwk-posthog.json`).keySource.buildEnv
  const product = readJson(root, `${BRANDING_DIR}/tmwk-product-name.json`).productName
  const repo = /\bTMWK_REPO\s*=\s*['"]([^'"]+)['"]/.exec(
    fs.readFileSync(path.join(root, `${BRANDING_DIR}/tmwk-product-name.ts`), 'utf8')
  )?.[1]
  if (!repo) {
    throw new Error(`${BRANDING_DIR}/tmwk-product-name.ts no longer exports TMWK_REPO as a literal`)
  }
  const slug = escape(product.toLowerCase())
  return [
    {
      name: 'upstream-host',
      kind: 'count',
      // onorca.dev before orca.dev and com.stablyai before stablyai, so one occurrence counts once.
      pattern: new RegExp(
        alternation([
          ...[...orcaHosts].sort((a, b) => b.length - a.length),
          'com.stablyai',
          'stablyai',
          'posthog'
        ]),
        'g'
      )
    },
    { name: 'forbidden-url', kind: 'count', pattern: new RegExp(alternation(forbiddenUrls), 'g') },
    {
      name: 'posthog-key',
      kind: 'count',
      pattern: new RegExp(`${escape(keyEnv)}|phc_[A-Za-z0-9_-]{8,}`, 'g')
    },
    {
      name: 'home-path',
      kind: 'count',
      pattern:
        /['"`/]\.orca(?=['"`/\\]|$)|\.orca-(?:remote|wsl|relay)\b|\.orca-\$\{|(?:^|['"`])agent-hooks(?=['"`/])/g
    },
    {
      name: 'tmwk-literal',
      kind: 'count',
      pattern: new RegExp(
        `(['"\`])${escape(product)}(?: Dev)?\\1|${escape(repo)}|dev\\.${slug}\\.app|${slug}:\\/\\/|['"\`/]\\.${slug}(?=['"\`/\\\\]|$)`,
        'g'
      )
    },
    {
      name: 'app-name',
      kind: 'count',
      pattern: /(['"`])(?:Orca(?: Dev| IDE)?|orca-(?:ide|dev))\1/g
    },
    {
      name: 'outbound-host',
      kind: 'entry',
      baseline: 'outbound-hosts',
      applies: (rel) => /^src\/(?:main|shared|cli|wsl-guest|preload)\//.test(rel),
      pattern: /https?:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)/gi,
      normalize: (value) => value.toLowerCase()
    },
    {
      name: 'env-name',
      kind: 'entry',
      baseline: 'env-names',
      pattern: /\b(ORCA_[A-Z0-9_]+)\b/g
    },
    {
      name: 'build-constant',
      kind: 'entry',
      baseline: 'build-constants',
      applies: (rel) =>
        /^(?:electron\.vite|vite\.[^/]+)\.config\.ts$/.test(rel) ||
        rel === 'src/types/build-constants.d.ts',
      values: buildConstantNames
    }
  ]
}

function buildConstantNames(rel, code) {
  if (rel.endsWith('.d.ts')) {
    return [...code.matchAll(/\bdeclare\s+const\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1])
  }
  const names = []
  for (const start of code.matchAll(/\bdefine\s*:\s*\{/g)) {
    let depth = 0
    let body = ''
    for (let index = start.index + start[0].length - 1; index < code.length; index++) {
      const char = code[index]
      depth += char === '{' ? 1 : char === '}' ? -1 : 0
      if (depth === 0) {
        break
      }
      body += depth === 1 ? char : ' '
    }
    names.push(
      ...[...body.matchAll(/(?:^|[{,])\s*['"]?([A-Za-z_$][\w$.]*)['"]?\s*:/g)].map((m) => m[1])
    )
  }
  return names
}

// Line-based on purpose: only whole-comment lines are skipped, so a trailing comment still counts.
function codeLines(rel, text) {
  const slash = SLASH_COMMENTED.test(rel)
  const hash = HASH_COMMENTED.test(rel)
  const lines = []
  let inBlock = false
  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    if (inBlock || (slash && trimmed.startsWith('/*'))) {
      const end = line.indexOf('*/', inBlock ? 0 : line.indexOf('/*') + 2)
      inBlock = end === -1
      if (inBlock || !line.slice(end + 2).trim()) {
        return
      }
    } else if (
      (slash && trimmed.startsWith('//')) ||
      (hash && trimmed.startsWith('#') && !trimmed.startsWith('#!'))
    ) {
      return
    }
    lines.push({ line: index + 1, text: line })
  })
  return lines
}

function matchesOf(category, rel, lines) {
  if (category.values) {
    const code = lines.map((entry) => entry.text).join('\n')
    return category.values(rel, code).map((value) => ({
      value,
      line: lines.find((entry) => entry.text.includes(value))?.line ?? 0
    }))
  }
  const found = []
  for (const { line, text } of lines) {
    for (const match of text.matchAll(category.pattern)) {
      const value =
        category.kind === 'entry'
          ? match.slice(1).find(Boolean)
          : match[0].replace(/^['"`/]+|['"`]+$/g, '')
      if (value) {
        found.push({ value: category.normalize ? category.normalize(value) : value, line })
      }
    }
  }
  return found
}

function ownPathMatcher(root) {
  const text = fs.readFileSync(path.join(root, OWNERSHIP_MAP), 'utf8')
  const start = text.indexOf('\n## The map')
  if (start === -1) {
    throw new Error(`${OWNERSHIP_MAP} has no "## The map" section`)
  }
  const end = text.indexOf('\n## ', start + 1)
  const patterns = []
  for (const row of text.slice(start, end === -1 ? undefined : end).split('\n')) {
    const cells = row.split('|').map((cell) => cell.trim())
    if (cells[2] !== 'Independent') {
      continue
    }
    for (const [, token] of cells[1].matchAll(/`([^`]+)`/g)) {
      const source = escape(token)
        .replace(/\\\*\\\*/g, '.*')
        .replace(/\\\*/g, '[^/]*')
      patterns.push(new RegExp(`^${source}$`))
    }
  }
  return (rel) => patterns.some((pattern) => pattern.test(rel))
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0)
}

function readSources(root, files, isOwn) {
  const sources = new Map()
  for (const rel of files) {
    if (SKIPPED.test(rel) || BINARY.test(rel) || isOwn(rel)) {
      continue
    }
    let buffer
    try {
      buffer = fs.readFileSync(path.join(root, rel))
    } catch {
      continue
    }
    if (!isBinary(buffer)) {
      sources.set(rel, buffer.toString('utf8'))
    }
  }
  return sources
}

function scan(root, files) {
  // A whole-file test first: most files match no category, and line splitting is the cost.
  const list = categories(root).map((category) => {
    const probe =
      category.pattern &&
      new RegExp(category.pattern.source, `${category.pattern.flags.replace('g', '')}m`)
    return { ...category, probe: (text) => !probe || probe.test(text) }
  })
  const sources = readSources(root, files, ownPathMatcher(root))
  const found = new Map(list.map((category) => [category.name, new Map()]))
  for (const [rel, text] of sources) {
    let lines
    for (const category of list) {
      if ((category.applies && !category.applies(rel)) || !category.probe(text)) {
        continue
      }
      lines ??= codeLines(rel, text)
      const matches = matchesOf(category, rel, lines)
      if (matches.length > 0) {
        found.get(category.name).set(rel, matches)
      }
    }
  }
  return { list, sources, found }
}

function baselineFile(root, category) {
  return path.join(root, BASELINE_DIR, `${category.baseline ?? category.name}.txt`)
}

function headerFor(category) {
  const format =
    category.kind === 'count' ? '<count> <path> # reason' : '<value> # reason, one per line'
  return [
    `# Identity tripwire baseline: ${category.name}. Format: ${format}.`,
    '# Lowered by --update; rows are added only by --accept with a reason.'
  ]
}

function parseEntries(text) {
  const entries = new Map()
  for (const line of parseEntryBaseline(text)) {
    const [value, ...reason] = line.split(/\s+#\s*/)
    entries.set(value, reason.join(' # ') || DEFAULT_REASON)
  }
  return entries
}

function readBaseline(root, category) {
  const file = baselineFile(root, category)
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (category.kind === 'count') {
    return {
      exists: text !== null,
      counts: parseCountBaseline(text ?? ''),
      notes: parseCountNotes(text ?? '')
    }
  }
  return { exists: text !== null, entries: parseEntries(text ?? '') }
}

function writeBaseline(root, category, baseline) {
  const file = baselineFile(root, category)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (category.kind === 'count') {
    fs.writeFileSync(
      file,
      formatCountBaseline(baseline.counts, headerFor(category), baseline.notes)
    )
    return
  }
  const rows = [...baseline.entries]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([value, reason]) => `${value} # ${reason}`)
  fs.writeFileSync(file, `${[...headerFor(category), ''].join('\n')}${rows.join('\n')}\n`)
}

const countsOf = (byFile) => new Map([...byFile].map(([rel, matches]) => [rel, matches.length]))
const uniqueLines = (matches) => [...new Set(matches.map((match) => match.line))]

function entryLocations(byFile) {
  const locations = new Map()
  for (const [rel, matches] of byFile) {
    for (const { value } of matches) {
      const files = locations.get(value) ?? new Set()
      locations.set(value, files.add(rel))
    }
  }
  return locations
}

// Scoped to the diff, a renamed file is held to its old path's row.
function scopedCounts(counts, sources, renames) {
  const scoped = new Map()
  for (const rel of sources.keys()) {
    const allowed = counts.get(rel) ?? counts.get(renames.get(rel))
    if (allowed !== undefined) {
      scoped.set(rel, allowed)
    }
  }
  return scoped
}

function evaluate(root, { list, sources, found }, changed) {
  const hits = []
  const improved = []
  for (const category of list) {
    const baseline = readBaseline(root, category)
    if (!baseline.exists) {
      throw new Error(`missing ${path.relative(root, baselineFile(root, category))}; run --init`)
    }
    const byFile = found.get(category.name)
    if (category.kind === 'count') {
      const allowed = changed
        ? scopedCounts(baseline.counts, sources, changed.renames)
        : baseline.counts
      const { grown, shrunk } = diffCounts(countsOf(byFile), allowed)
      for (const { file, now, allowed: was } of grown) {
        const matches = byFile.get(file)
        hits.push({
          category: category.name,
          path: file,
          value: [...new Set(matches.map((match) => match.value))].join(', '),
          now,
          allowed: was,
          lines: uniqueLines(matches)
        })
      }
      improved.push(
        ...shrunk.map(({ file, now, allowed: was }) => ({
          category: category.name,
          path: file,
          now,
          allowed: was
        }))
      )
      continue
    }
    const locations = entryLocations(byFile)
    const { added, stale } = diffEntries(locations.keys(), baseline.entries.keys())
    for (const value of added) {
      for (const file of locations.get(value)) {
        hits.push({
          category: category.name,
          path: file,
          value,
          now: 1,
          allowed: 0,
          lines: uniqueLines(byFile.get(file).filter((match) => match.value === value))
        })
      }
    }
    if (!changed) {
      improved.push(
        ...stale.map((value) => ({ category: category.name, value, now: 0, allowed: 1 }))
      )
    }
  }
  return { hits, improved }
}

function report(list, { hits, improved }, added) {
  const kinds = new Map(list.map((category) => [category.name, category.kind]))
  for (const hit of hits) {
    console.error(
      kinds.get(hit.category) === 'entry'
        ? `${hit.category} new: ${hit.value} (${hit.path})`
        : `${hit.category} ${hit.path}: now ${hit.now}, baseline ${hit.allowed} (${hit.value})`
    )
    const fileAdded = added?.get(hit.path)
    const lines = added ? hit.lines.filter((line) => fileAdded?.has(line)) : hit.lines.slice(0, 5)
    for (const line of lines) {
      console.error(
        added ? `  + ${hit.path}:${line}: ${fileAdded.get(line).trim()}` : `  ${hit.path}:${line}`
      )
    }
  }
  for (const entry of improved) {
    console.log(
      entry.path
        ? `progress: ${entry.category} ${entry.path}: now ${entry.now}, baseline ${entry.allowed}`
        : `progress: ${entry.category} gone: ${entry.value}`
    )
  }
  if (improved.length > 0) {
    console.log('Lower the baseline with --update.')
  }
  if (hits.length > 0) {
    console.error(
      `\n${hits.length} identity hit(s). Route each through ${IDENTITY_DIR}/, or accept it with a reason:\n` +
        '  pnpm tmwk:identity-tripwire --accept <category> <path|value> "<reason>"'
    )
  }
}

// Renamed files keep their old row and its reason; renames come from --diff <base>, else origin/main.
function baselineRenames(root, base) {
  const ref = base ?? (resolvesToCommit(root, 'origin/main') ? 'origin/main' : null)
  return ref ? changedFiles(root, ref, DIFF_SCOPE).renames : new Map()
}

function carryRenamedRow(baseline, renames, rel) {
  const old = renames.get(rel)
  if (!old || baseline.counts.has(rel) || !baseline.counts.has(old)) {
    return
  }
  baseline.counts.set(rel, baseline.counts.get(old))
  baseline.notes.set(rel, baseline.notes.get(old) ?? DEFAULT_REASON)
  baseline.counts.delete(old)
  baseline.notes.delete(old)
}

function update(root, { list, found }, options) {
  const renames = baselineRenames(root, options.diff)
  for (const category of list) {
    const baseline = readBaseline(root, category)
    const byFile = found.get(category.name)
    if (category.kind === 'count') {
      for (const rel of renames.keys()) {
        carryRenamedRow(baseline, renames, rel)
      }
      const current = countsOf(byFile)
      for (const [rel, allowed] of baseline.counts) {
        baseline.counts.set(rel, Math.min(allowed, current.get(rel) ?? 0))
      }
    } else {
      const current = entryLocations(byFile)
      for (const value of baseline.entries.keys()) {
        if (!current.has(value)) {
          baseline.entries.delete(value)
        }
      }
    }
    writeBaseline(root, category, baseline)
  }
}

function accept(root, { list, found }, options) {
  const [name, target, reason] = options.accept
  const category = list.find((candidate) => candidate.name === name)
  if (!category) {
    throw new Error(`unknown category ${name}; one of ${list.map((c) => c.name).join(', ')}`)
  }
  if (!target || !reason?.trim()) {
    throw new Error(
      '--accept needs <category> <path|value> "<reason>", and the reason may not be empty'
    )
  }
  const baseline = readBaseline(root, category)
  const byFile = found.get(category.name)
  if (category.kind === 'count') {
    const now = byFile.get(target)?.length ?? 0
    if (now === 0) {
      throw new Error(`${name}: ${target} has no matches to accept`)
    }
    carryRenamedRow(baseline, baselineRenames(root, options.diff), target)
    const carried = baseline.notes.get(target)
    baseline.counts.set(target, now)
    baseline.notes.set(
      target,
      carried && carried !== reason.trim() ? `${reason.trim()}; was: ${carried}` : reason.trim()
    )
  } else {
    if (!entryLocations(byFile).has(target)) {
      throw new Error(`${name}: ${target} is not in the tree`)
    }
    baseline.entries.set(target, reason.trim())
  }
  writeBaseline(root, category, baseline)
  console.log(`Accepted ${name} ${target}: ${baseline.notes?.get(target) ?? reason.trim()}`)
}

// Writes only missing baselines, so it can seed a new category but never re-grant an old one.
function init(root, { list, found }) {
  for (const category of list) {
    if (readBaseline(root, category).exists) {
      continue
    }
    const byFile = found.get(category.name)
    const baseline =
      category.kind === 'count'
        ? {
            counts: countsOf(byFile),
            notes: new Map([...byFile.keys()].map((rel) => [rel, DEFAULT_REASON]))
          }
        : {
            entries: new Map(
              [...entryLocations(byFile).keys()].map((value) => [value, DEFAULT_REASON])
            )
          }
    writeBaseline(root, category, baseline)
    console.log(`Wrote ${path.relative(root, baselineFile(root, category))}`)
  }
}

function parseArgs(argv) {
  const options = { mode: 'check', json: null, diff: null, accept: null }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--check' || argument === '--') {
      continue
    } else if (argument === '--update' || argument === '--init') {
      options.mode = argument.slice(2)
    } else if (argument === '--json' || argument === '--diff') {
      const value = argv[++index]
      if (!value) {
        throw new Error(`${argument} needs a value`)
      }
      options[argument.slice(2)] = value
    } else if (argument === '--accept') {
      options.mode = 'accept'
      options.accept = argv.slice(index + 1, index + 4)
      index += 3
    } else {
      throw new Error(
        `unknown option ${argument}. Use --check, --json <file>, --update, --diff <base>, or --accept <category> <path|value> "<reason>".`
      )
    }
  }
  return options
}

/** Returns 0 when clean, 1 on hits; throws on a script error. */
export function runIdentityTripwire(root, argv = []) {
  const options = parseArgs(argv)
  if (options.mode !== 'check') {
    const result = scan(root, scannableFiles(root, SCAN_PATHSPECS))
    ;({ update, accept, init })[options.mode](root, result, options)
    return 0
  }
  const changed = options.diff ? changedFiles(root, options.diff, DIFF_SCOPE) : null
  // A changed map can move any path in or out of scope, so the diff scan is not enough.
  const scoped = changed && !changed.mapChanged ? changed : null
  if (changed?.mapChanged) {
    console.log(`identity tripwire: ${OWNERSHIP_MAP} changed; scanning the whole tree.`)
  }
  const result = scan(root, scoped ? scoped.files : scannableFiles(root, SCAN_PATHSPECS))
  const outcome = evaluate(root, result, scoped)
  report(result.list, outcome, changed && addedLines(root, changed, result.sources))
  if (options.json) {
    fs.writeFileSync(options.json, `${JSON.stringify(outcome, null, 2)}\n`)
  }
  if (outcome.hits.length === 0) {
    console.log(
      `identity tripwire: clean (${result.sources.size} ${scoped ? 'changed file(s)' : 'files'}).`
    )
  }
  return outcome.hits.length > 0 ? 1 : 0
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  try {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()
    process.exitCode = runIdentityTripwire(root, process.argv.slice(2))
  } catch (error) {
    console.error(`identity tripwire: ${error.message ?? error}`)
    process.exitCode = 2
  }
}
