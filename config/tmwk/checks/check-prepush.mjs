// tmwk pre-push gate: a fixed, fast subset of check:changed, run in parallel (code-quality-plan P0.3).
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BUDGET_SECONDS = 30
const OUTPUT_TAIL_LINES = 200
// Windows caps a command line near 32K characters; past this, lint the whole tree instead.
const MAX_PATH_ARGUMENT_CHARS = 24_000
const LINTABLE = /\.[cm]?[jt]sx?$/
const ANTI_SLOP_ROOTS = ['src/', 'config/', 'tests/', 'mobile/']
// Beside the script: the nightly runs a copy of this directory from outside the checkout.
const NO_CYCLE_CONFIG = fileURLToPath(new URL('./oxlint-no-cycle.json', import.meta.url))
const NO_CYCLE_CODE = 'import(no-cycle)'

// Upstream modules load from the checkout under test, not from beside this script.
async function importUpstream(root) {
  const load = (file) => import(pathToFileURL(path.join(root, 'config', 'scripts', file)).href)
  const [passCache, selection, astGrep, oxc, bun, pnpm] = await Promise.all([
    load('preflight/changed-checks/check-changed-pass-cache.mjs'),
    load('preflight/changed-checks/check-changed-selection.mjs'),
    load('static-analysis/structural-scan/ast-grep-scan.mjs'),
    load('tool-invocation/oxc-cli-invocation.mjs'),
    load('tool-invocation/pinned-bun-executable.mjs'),
    load('tool-invocation/pnpm-cli-invocation.mjs')
  ])
  return { ...passCache, ...selection, ...astGrep, ...oxc, ...bun, ...pnpm }
}

function parseArgs(argv) {
  const options = { base: null }
  for (const argument of argv) {
    if (argument.startsWith('--base=')) {
      options.base = argument.slice('--base='.length)
    } else if (argument !== '--') {
      throw new Error(`Unknown option ${argument}. Use --base=<ref>.`)
    }
  }
  return options
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  }).trim()
}

// Same base rules as check:changed.
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
  }
  throw new Error('No base: fetch origin/main or pass --base=<ref>.')
}

function secondsSince(startedAt) {
  return Number(((performance.now() - startedAt) / 1000).toFixed(1))
}

function tail(text) {
  const lines = text.trimEnd().split(/\r?\n/)
  if (lines.length <= OUTPUT_TAIL_LINES) {
    return lines.join('\n')
  }
  return [
    `… ${lines.length - OUTPUT_TAIL_LINES} earlier lines omitted`,
    ...lines.slice(-OUTPUT_TAIL_LINES)
  ].join('\n')
}

function fitsCommandLine(files) {
  return files.reduce((total, file) => total + file.length + 1, 0) <= MAX_PATH_ARGUMENT_CHARS
}

const runningChildren = new Set()
let cancelling = false

// Steps spawn their own workers (tc), so kill the whole tree: a POSIX process group, or taskkill /T.
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  child.cancelled = true
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {}
}

function cancelRunningSteps() {
  cancelling = true
  for (const child of runningChildren) {
    killTree(child)
  }
}

function runCommand({ program, args, shell = false }, { root, env }) {
  if (cancelling) {
    return Promise.resolve({ code: 1, stdout: '', stderr: '', cancelled: true })
  }
  return new Promise((resolve) => {
    const child = spawn(program, args, {
      cwd: root,
      env,
      shell,
      windowsHide: true,
      detached: process.platform !== 'win32'
    })
    runningChildren.add(child)
    let stdout = ''
    let stderr = ''
    const finish = (result) => {
      runningChildren.delete(child)
      resolve({ ...result, stdout, cancelled: child.cancelled === true })
    }
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => finish({ code: 1, stderr: `${stderr}${error.message}` }))
    child.on('close', (code) => finish({ code: code ?? 1, stderr }))
  })
}

// Matches the result shape resolvePinnedBunExecutable expects, without building @orca/process-host.
function runProcessSync({ program, args, cwd, env, timeoutMs }) {
  const result = spawnSync(program, args, {
    cwd,
    env,
    timeout: timeoutMs,
    encoding: 'utf8',
    windowsHide: true
  })
  return {
    code: result.status,
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? ''
  }
}

// Value imports and re-exports at statement start; `import type` cannot form a cycle under ignoreTypes.
const VALUE_IMPORT_SPECIFIER =
  /^[ \t]*(?:import|export)(?![ \t]+type[\s{])(?:[^'"`;]*?\bfrom)?[ \t]*['"]([^'"\n]+)['"]/gm

function valueImportSpecifiers(source) {
  return new Set([...source.matchAll(VALUE_IMPORT_SPECIFIER)].map((match) => match[1]))
}

function renamedBasePaths(root, mergeBase) {
  const entries = git(root, ['diff', '-M', '--name-status', '-z', mergeBase, '--'])
    .split('\0')
    .filter(Boolean)
  const basePaths = new Map()
  for (let index = 0; index < entries.length;) {
    const status = entries[index++]
    const source = entries[index++]
    if (status.startsWith('R') || status.startsWith('C')) {
      basePaths.set(entries[index++], source)
    }
  }
  return basePaths
}

function baseValueImports(root, mergeBase, basePath) {
  const shown = spawnSync('git', ['show', `${mergeBase}:${basePath}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  })
  return shown.status === 0 ? valueImportSpecifiers(shown.stdout) : new Set()
}

function cycleSpecifier(root, diagnostic) {
  const span = diagnostic.labels?.[0]?.span
  const source = readFileSync(path.join(root, diagnostic.filename))
  return source
    .subarray(span.offset, span.offset + span.length)
    .toString('utf8')
    .replace(/^['"]|['"]$/g, '')
}

// A cycle is pre-existing when the file's base version already value-imports the flagged specifier.
function newCycleDiagnostics(stdout, { root, mergeBase }) {
  let basePaths
  const importsByFile = new Map()
  return JSON.parse(stdout).diagnostics.filter((diagnostic) => {
    if (diagnostic.code !== NO_CYCLE_CODE) {
      return true
    }
    const file = diagnostic.filename.replaceAll('\\', '/')
    if (!importsByFile.has(file)) {
      basePaths ??= renamedBasePaths(root, mergeBase)
      importsByFile.set(file, baseValueImports(root, mergeBase, basePaths.get(file) ?? file))
    }
    return !importsByFile.get(file).has(cycleSpecifier(root, diagnostic))
  })
}

function formatCycleDiagnostic(diagnostic) {
  const line = diagnostic.labels?.[0]?.span?.line
  return `${diagnostic.filename}:${line}: ${diagnostic.code} ${diagnostic.message}\n${diagnostic.note ?? ''}`
}

function rootIgnorePatterns(root) {
  return JSON.parse(readFileSync(path.join(root, '.oxlintrc.json'), 'utf8')).ignorePatterns ?? []
}

function buildSteps(root, upstream, { files, mergeBase }) {
  const {
    AST_GREP_CONFIG,
    AST_GREP_SCAN_PATHS,
    resolveAstGrepBinary,
    resolveOxcCliInvocation,
    resolvePinnedBunExecutable,
    resolvePnpmCliInvocation,
    selectTypecheckProjects
  } = upstream
  const node = process.execPath
  const oxlint = resolveOxcCliInvocation('oxlint', 'oxlint', root)
  const oxfmt = resolveOxcCliInvocation('oxfmt', 'oxfmt', root)
  const existing = files.filter((file) => existsSync(path.join(root, file)))
  const lintable = existing.filter((file) => LINTABLE.test(file))
  const wholeTree = !fitsCommandLine(lintable)
  const antiSlop = lintable.filter((file) =>
    ANTI_SLOP_ROOTS.some((prefix) => file.startsWith(prefix))
  )
  const command = (program, args, shell = false) => ({ program, args, shell })
  const steps = []

  if (selectTypecheckProjects(files).length > 0) {
    const pnpm = resolvePnpmCliInvocation()
    steps.push({
      name: 'typecheck',
      commands: [command(pnpm.command, [...pnpm.prefixArgs, 'tc'], pnpm.shell)]
    })
  }
  if (existing.length > 0) {
    steps.push({
      name: 'format',
      commands: [
        command(oxfmt.command, [
          ...oxfmt.prefixArgs,
          '--check',
          '--no-error-on-unmatched-pattern',
          ...(fitsCommandLine(existing) ? existing : ['.'])
        ])
      ]
    })
  }
  if (lintable.length === 0) {
    return steps
  }
  steps.push({
    name: 'lint',
    commands: [
      command(oxlint.command, [
        ...oxlint.prefixArgs,
        '--quiet',
        '--no-error-on-unmatched-pattern',
        ...(wholeTree ? [] : lintable)
      ])
    ]
  })
  if (antiSlop.length > 0) {
    const bun = resolvePinnedBunExecutable(root, runProcessSync) ?? 'bun'
    steps.push({
      name: 'anti-slop',
      commands: [
        command(node, [
          'config/scripts/static-analysis/oxlint-contracts/sync-anti-slop-plugin.mjs'
        ]),
        command(bun, [
          '--smol',
          ...oxlint.prefixArgs,
          '--config',
          'config/oxlint-anti-slop.json',
          '--deny-warnings',
          ...(wholeTree ? ANTI_SLOP_ROOTS : antiSlop)
        ])
      ]
    })
  }
  steps.push({
    name: 'ast-grep',
    commands: [
      command(resolveAstGrepBinary(), [
        'scan',
        '--config',
        AST_GREP_CONFIG,
        '--min-severity',
        'warning',
        '--color',
        'never',
        '--',
        ...(wholeTree ? AST_GREP_SCAN_PATHS : lintable)
      ])
    ]
  })
  steps.push({
    name: 'cycles',
    commands: [
      command(oxlint.command, [
        ...oxlint.prefixArgs,
        '--config',
        NO_CYCLE_CONFIG,
        // Config ignorePatterns resolve from the config's own directory, so take root's as cwd-relative flags.
        ...rootIgnorePatterns(root).map((pattern) => `--ignore-pattern=${pattern}`),
        '--format',
        'json',
        '--no-error-on-unmatched-pattern',
        ...(wholeTree ? [] : lintable)
      ])
    ],
    evaluate: (result) => {
      const diagnostics = newCycleDiagnostics(result.stdout, { root, mergeBase })
      return {
        ok: diagnostics.length === 0,
        output: diagnostics.map(formatCycleDiagnostic).join('\n')
      }
    }
  })
  return steps
}

async function runStep(step, context) {
  const startedAt = performance.now()
  let output = ''
  const finish = (status, text = output) => ({
    name: step.name,
    status,
    output: text,
    seconds: secondsSince(startedAt)
  })
  for (const command of step.commands) {
    const result = await runCommand(command, context)
    if (result.cancelled) {
      return finish('cancelled')
    }
    if (step.evaluate) {
      try {
        const evaluated = step.evaluate(result)
        return finish(evaluated.ok ? 'passed' : 'failed', evaluated.output)
      } catch (error) {
        return finish('failed', `${result.stdout}${result.stderr}${error.message ?? error}`)
      }
    }
    output += result.stdout + result.stderr
    if (result.code !== 0) {
      return finish('failed')
    }
  }
  return finish('passed')
}

function appendTimes(record) {
  const file =
    process.env.TMWK_PREPUSH_TIMES_FILE ||
    path.join(os.homedir(), '.cache', 'tmwk', 'prepush-times.jsonl')
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify(record)}\n`)
  } catch (error) {
    console.error(`pre-push: could not log times to ${file}: ${error.message ?? error}`)
  }
}

export async function main(root, argv) {
  const startedAt = performance.now()
  const options = parseArgs(argv)
  const { ref, mergeBase } = resolveMergeBase(root, options.base)
  const upstream = await importUpstream(root)
  const files = upstream.collectChangedFiles(root, mergeBase)
  const steps = buildSteps(root, upstream, { files, mergeBase })
  console.log(
    `pre-push: ${files.length} changed file(s) since ${ref} (${mergeBase.slice(0, 10)}); running ${steps.map((step) => step.name).join(', ') || 'nothing'}.`
  )
  const env = { ...process.env, ...(process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}) }
  const results = await Promise.all(
    steps.map(async (step) => {
      const result = await runStep(step, { root, env })
      if (result.status === 'passed') {
        console.log(`✓ ${result.name} (${result.seconds}s)`)
      } else if (result.status === 'cancelled') {
        console.log(`- ${result.name} cancelled (${result.seconds}s)`)
      } else {
        cancelRunningSteps()
        console.error(`\n✗ ${result.name} (${result.seconds}s)\n${tail(result.output)}`)
      }
      return result
    })
  )
  const totalSeconds = secondsSince(startedAt)
  const failed = results.filter((result) => result.status === 'failed')
  appendTimes({
    date: new Date().toISOString(),
    host: os.hostname(),
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpus: os.availableParallelism(),
    platform: process.platform,
    arch: process.arch,
    base: mergeBase,
    files: files.length,
    steps: Object.fromEntries(
      results.map((result) => [
        result.name,
        result.status === 'cancelled' ? 'cancelled' : result.seconds
      ])
    ),
    totalSeconds,
    ok: failed.length === 0
  })
  if (totalSeconds > BUDGET_SECONDS) {
    console.warn(
      `pre-push: took ${totalSeconds}s, over the ${BUDGET_SECONDS}s budget. Not failing for time; see code-quality-plan P0.3.`
    )
  }
  if (failed.length > 0) {
    console.error(
      `\n✗ pre-push: ${failed.length} of ${results.length} check(s) failed in ${totalSeconds}s: ${failed.map((result) => result.name).join(', ')}`
    )
    return 1
  }
  console.log(`✓ pre-push: ${results.length} check(s) passed in ${totalSeconds}s.`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Detached children leave the terminal's process group, so Ctrl-C must reach them through here.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      cancelRunningSteps()
      process.exit(130)
    })
  }
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    }).trim()
    process.exitCode = await main(root, process.argv.slice(2))
  } catch (error) {
    console.error(`pre-push: ${error.message ?? error}`)
    process.exitCode = 1
  }
}
