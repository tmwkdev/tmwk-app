import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPosixRunnerScript } from '../../workspace-hooks/setup-runner-script-text'
import {
  POSIX_SETUP_RUNNER_OUTER_SCRIPT,
  posixSetupRunnerBodyPath
} from '../../../shared/tmwk/setup-terminal/setup-runner-success-marker'

const MARKER = '__TMWK_SETUP' + '_SUCCEEDED__'
const NONCE = '7d0c2f4e-1b9a-4c3e-8f6d-2a5b9c1e0f37'
const dirs: string[] = []

/** Writes the runner pair as createWorktreeRunnerScript does and runs it as the Setup terminal would. */
function runRunner(script: string, nonce: string | null = NONCE) {
  const dir = mkdtempSync(join(tmpdir(), 'tmwk-setup-runner-'))
  dirs.push(dir)
  const runnerPath = join(dir, 'setup-runner.sh')
  writeFileSync(posixSetupRunnerBodyPath(runnerPath), buildPosixRunnerScript(script))
  writeFileSync(runnerPath, POSIX_SETUP_RUNNER_OUTER_SCRIPT)
  const env = { ...process.env }
  delete env.TMWK_SETUP_RUN_NONCE
  if (nonce !== null) {
    env.TMWK_SETUP_RUN_NONCE = nonce
  }
  const result = spawnSync('bash', [runnerPath], { cwd: dir, encoding: 'utf8', env })
  return { dir, runnerPath, stdout: result.stdout, status: result.status }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe.skipIf(process.platform === 'win32')('setup runner success line', () => {
  it('prints the success line with its nonce last when the script passes, holding it in neither file', () => {
    const run = runRunner('echo installing')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe(`installing\n${MARKER}:${NONCE}\n`)
    expect(readFileSync(run.runnerPath, 'utf8')).not.toContain(MARKER)
    expect(readFileSync(posixSetupRunnerBodyPath(run.runnerPath), 'utf8')).not.toContain(MARKER)
  })

  it('prints nothing extra for a runner started by hand without a nonce', () => {
    expect(runRunner('echo installing', null).stdout).toBe('installing\n')
  })

  it('keeps a failing exit status and prints nothing', () => {
    const run = runRunner('echo installing\nexit 3\necho unreachable')
    expect(run.status).toBe(3)
    expect(run.stdout).toBe('installing\n')
  })

  it('reports a script that exits 0 midway as passed', () => {
    const run = runRunner('echo installing\nexit 0\necho unreachable')
    expect(run.status).toBe(0)
    expect(run.stdout).toBe(`installing\n${MARKER}:${NONCE}\n`)
  })

  it('leaves a file an unterminated heredoc writes exactly as the script wrote it', () => {
    const run = runRunner('cat <<EOF > .env\nFOO=1')
    expect(readFileSync(join(run.dir, '.env'), 'utf8')).toBe('FOO=1\n')
  })
})
