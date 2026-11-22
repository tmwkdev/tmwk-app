import { describe, expect, it, vi } from 'vitest'
import type { ProcessTableRow } from '../../../../shared/process-observation/tables/process-table-snapshot'
import type { SubprocessHandle } from '../../sessions/session-subprocess-handle'
import { TerminalHost } from '../terminal-host'

import '../../pty-subprocess/testing/mock-descendant-sweep'

const snapshot = vi.hoisted(() => ({ rows: new Array<ProcessTableRow>() }))

vi.mock(
  '../../../../shared/process-observation/tables/process-table-snapshot-reader',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getStrictProcessTableSnapshotWithAge: async () => ({ rows: snapshot.rows, capturedAgeMs: 0 })
  })
)

// The macOS login wrapper (the PTY root) and the interactive zsh it starts.
const LAUNCH_CHAIN: ProcessTableRow[] = [
  {
    pid: 78560,
    ppid: 1,
    pgid: 78560,
    tpgid: 78568,
    tty: 'ttys006',
    startTime: 'Sun Nov 22 09:00:00 2026',
    stat: 'Ss',
    command: '/usr/bin/login -flpq ty /bin/bash --noprofile --norc -p -c trampoline orca-tcc-login'
  },
  {
    pid: 78568,
    ppid: 78560,
    pgid: 78568,
    tpgid: 78568,
    tty: 'ttys006',
    startTime: 'Sun Nov 22 09:00:01 2026',
    stat: 'S+',
    command: '-zsh'
  }
]

const BACKGROUND_JOB: ProcessTableRow = {
  pid: 78600,
  ppid: 78568,
  pgid: 78600,
  tpgid: 78568,
  tty: 'ttys006',
  startTime: 'Sun Nov 22 09:01:00 2026',
  stat: 'S',
  command: 'node dev-server.js'
}

function subprocess() {
  let exitListener: ((code: number) => void) | undefined
  return {
    pid: 78560,
    shellPath: '/bin/zsh',
    getForegroundProcess: () => 'zsh',
    write() {},
    resize() {},
    signal() {},
    kill() {
      exitListener?.(0)
    },
    forceKill() {
      exitListener?.(137)
    },
    terminateOwnedTree: () => 'unavailable' as const,
    onData() {},
    onExit(listener: (code: number) => void) {
      exitListener = listener
    },
    dispose() {
      exitListener = undefined
    }
  } satisfies SubprocessHandle
}

async function censusWith(processes: ProcessTableRow[]) {
  // A fresh array: process-table indexes are cached per capture.
  snapshot.rows = [...processes]
  const host = new TerminalHost({ spawnSubprocess: async () => subprocess() })
  try {
    const controller = new AbortController()
    await host.createOrAttach({
      sessionId: 'census',
      cols: 80,
      rows: 24,
      env: {},
      streamClient: { onData() {}, onExit() {} },
      cancelSignal: controller.signal,
      isCanceled: () => false
    })
    return (await host.inspectProcess('census', { scanChildProcesses: true })).childProcessEvidence
  } finally {
    await host.dispose()
  }
}

describe.skipIf(process.platform === 'win32')('TerminalHost POSIX child census', () => {
  it('counts a background job under the login-wrapped shell', async () => {
    expect(await censusWith([...LAUNCH_CHAIN, BACKGROUND_JOB])).toBe('children')
  })

  it('reads the login wrapper and its shell alone as no children', async () => {
    expect(await censusWith(LAUNCH_CHAIN)).toBe('no-children')
  })
})
