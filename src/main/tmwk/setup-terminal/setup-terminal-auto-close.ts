import { SETUP_RUNNER_SUCCESS_MARKER } from '../../../shared/tmwk/setup-terminal/setup-runner-success-marker'
import { createOsc133CommandFinishedScanner } from '../../../shared/terminal/output/terminal-osc133-command-finished'
import { buildRestoredTerminalTailSeed } from '../../runtime/terminal/output/tail/terminal-tail-restore-seed'
import { readIdleSetupTerminalOutcome } from './idle-setup-terminal-outcome'

/** What the closer needs from the runtime that owns the PTY. */
export type SetupTerminalClosePorts = {
  /** A registered completion token means a setup waiter will read this PTY's output and close it. */
  hasCompletionToken: (ptyId: string) => boolean
  /** True once for a nonce this process minted for a setup run. */
  consumeRunNonce: (nonce: string) => boolean
  /** Null when the host cannot tell. */
  hasChildProcesses: (ptyId: string) => Promise<boolean | null>
  /** Whether the worktree keeps another terminal or tab once this one closes; null when unsure. */
  hasOtherSurfacesInWorktree: (ptyId: string) => boolean | null
  /** When a user last typed into this PTY; Orca's own writes do not count. */
  lastUserInputAt: (ptyId: string) => number | null
  /** The handle of the pane showing this PTY, or null while no pane holds it. */
  resolveHandle: (ptyId: string) => string | null
  closeTerminal: (handle: string) => Promise<unknown>
  subscribeToPtyExit: (ptyId: string, listener: () => void) => () => void
  delay?: (ms: number) => Promise<void>
  now?: () => number
}

export type SetupTerminalAutoClose = ReturnType<typeof createSetupTerminalAutoClose>

const ATTEMPTS = 20
const RETRY_MS = 500
// A daemon reads a foreground `bash -lc` wrapper as an idle shell, so the shell's own command end
// (OSC 133;D) proves a wrapper finished; a shell without integration closes after this many attempts.
const COMMAND_END_GRACE_ATTEMPTS = 10
// Line start, or right after a CSI a ConPTY repaint puts before the text.
const RUN_SUCCESS_LINE = new RegExp(
  `(?:^|[\\r\\n]|\\x1b\\[[0-9;?]*[A-Za-z])${SETUP_RUNNER_SUCCESS_MARKER}:([0-9a-f-]{36})\\r?\\n`,
  'g'
)
const RUN_SUCCESS_LINE_LENGTH = SETUP_RUNNER_SUCCESS_MARKER.length + 1 + 36 + 2
const LINE_START_SLACK = 16
const OBSERVED_SETUP_RESULT = /__ORCA_SETUP_COMPLETE__:[^:\s]+:(-?\d+)/g

/** One close attempt per PTY, fed the output after setup's success. */
type Watch = {
  aborted: boolean
  /** The setup's own command ended at the shell (OSC 133;D). */
  commandEnded: boolean
  /** A setup waiter read exit 0 itself, so an unknown child-process answer may still close. */
  provenByWaiter: boolean
  startedAt: number
  scan: (data: string) => void
}

export function createSetupTerminalAutoClose(ports: SetupTerminalClosePorts) {
  const delay =
    ports.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = ports.now ?? Date.now
  // Only a chunk that may end inside a success line keeps a carry, and only until the next chunk or exit.
  const carries = new Map<string, { text: string; release: () => void }>()
  const watches = new Map<string, Watch>()
  const waiters = new Map<string, number>()
  // Success lines printed while a waiter owned the PTY; an abandoned wait closes from them.
  const passedWhileOwned = new Map<string, () => void>()

  const ownedByWaiter = (ptyId: string): boolean =>
    ports.hasCompletionToken(ptyId) || (waiters.get(ptyId) ?? 0) > 0

  const abort = (ptyId: string, watch: Watch): void => {
    watch.aborted = true
    if (watches.get(ptyId) === watch) {
      watches.delete(ptyId)
    }
  }

  const createWatch = (ptyId: string, commandEnded: boolean, provenByWaiter: boolean): Watch => {
    const watch: Watch = {
      aborted: false,
      commandEnded,
      provenByWaiter,
      startedAt: now(),
      scan: () => {}
    }
    const commands = createOsc133CommandFinishedScanner(
      (exitCode) => {
        // A second command end, or a failing one (a user EXIT trap), is not setup passing.
        if (watch.commandEnded || (exitCode !== null && exitCode !== 0)) {
          abort(ptyId, watch)
        }
        watch.commandEnded = true
      },
      () => {
        if (watch.commandEnded) {
          abort(ptyId, watch)
        }
      }
    )
    watch.scan = (data) => {
      for (const result of data.matchAll(OBSERVED_SETUP_RESULT)) {
        if (result[1] !== '0') {
          abort(ptyId, watch)
        }
      }
      commands.scan(data)
    }
    return watch
  }

  const closeWhenIdle = async (ptyId: string, watch: Watch): Promise<void> => {
    let exited = false
    const release = ports.subscribeToPtyExit(ptyId, () => {
      exited = true
    })
    const stopped = (): boolean =>
      exited || watch.aborted || watches.get(ptyId) !== watch || ownedByWaiter(ptyId)
    const userTyped = (): boolean => (ports.lastUserInputAt(ptyId) ?? -Infinity) > watch.startedAt
    try {
      for (let attempt = 0; attempt < ATTEMPTS && !stopped(); attempt += 1) {
        await delay(RETRY_MS)
        if (stopped()) {
          return
        }
        if (userTyped()) {
          abort(ptyId, watch)
          return
        }
        const graceOver = attempt >= COMMAND_END_GRACE_ATTEMPTS
        if (!watch.commandEnded && !graceOver) {
          continue
        }
        // A wrapper still exiting, or a background job setup left running (a dev server), keeps it.
        const children = await ports.hasChildProcesses(ptyId)
        if (children === true || (children === null && !(watch.provenByWaiter && graceOver))) {
          continue
        }
        // Closing a worktree's last surface would leave it empty; another may still appear.
        if (ports.hasOtherSurfacesInWorktree(ptyId) !== true) {
          continue
        }
        const handle = ports.resolveHandle(ptyId)
        if (userTyped()) {
          abort(ptyId, watch)
          return
        }
        if (handle && !stopped()) {
          await ports.closeTerminal(handle)
          return
        }
      }
    } catch (error) {
      console.warn('[setup-terminal] could not close a passed Setup terminal:', error)
    } finally {
      release()
      if (watches.get(ptyId) === watch) {
        watches.delete(ptyId)
      }
    }
  }

  const startWatch = (
    ptyId: string,
    outputAfterSuccess: string,
    options: { commandEnded?: boolean; provenByWaiter?: boolean } = {}
  ): void => {
    if (watches.has(ptyId)) {
      return
    }
    const watch = createWatch(ptyId, options.commandEnded ?? false, options.provenByWaiter ?? false)
    watches.set(ptyId, watch)
    watch.scan(outputAfterSuccess)
    if (!watch.aborted) {
      void closeWhenIdle(ptyId, watch)
    }
  }

  const keepCarry = (ptyId: string, text: string): void => {
    const pending = pendingSuccessLine(text)
    if (!pending) {
      return
    }
    const entry = { text: pending, release: () => {} }
    carries.set(ptyId, entry)
    entry.release = ports.subscribeToPtyExit(ptyId, () => {
      if (carries.get(ptyId) === entry) {
        carries.delete(ptyId)
      }
    })
  }

  const forgetPassedWhileOwned = (ptyId: string): boolean => {
    const release = passedWhileOwned.get(ptyId)
    passedWhileOwned.delete(ptyId)
    release?.()
    return release !== undefined
  }

  return {
    /** Every chunk a PTY prints; this run's success line closes a Setup terminal no waiter owns. */
    observe(ptyId: string, data: string): void {
      const watch = watches.get(ptyId)
      if (watch) {
        watch.scan(data)
        return
      }
      const carry = carries.get(ptyId)
      if (carry) {
        carries.delete(ptyId)
        carry.release()
      }
      const text = carry ? carry.text + data : data
      const passedAt = findOwnSuccessLineEnd(text, ports.consumeRunNonce)
      if (passedAt === -1) {
        keepCarry(ptyId, text)
      } else if (ownedByWaiter(ptyId)) {
        forgetPassedWhileOwned(ptyId)
        passedWhileOwned.set(
          ptyId,
          ports.subscribeToPtyExit(ptyId, () => passedWhileOwned.delete(ptyId))
        )
      } else {
        startWatch(ptyId, text.slice(passedAt))
      }
    },

    /** Follows a setup completion wait: exit 0 closes the terminal; an abandoned wait hands the PTY back. */
    async followSetupWait<T extends { exitCode: number | null }>(
      ptyId: string,
      wait: Promise<T>,
      releaseCompletionToken: () => void
    ): Promise<T> {
      waiters.set(ptyId, (waiters.get(ptyId) ?? 0) + 1)
      let completion: T
      try {
        completion = await wait
      } catch (error) {
        // Nobody else will read the token: the runner's own success line decides, even one already printed.
        if (waiters.get(ptyId) === 1) {
          releaseCompletionToken()
          if (forgetPassedWhileOwned(ptyId)) {
            queueMicrotask(() => startWatch(ptyId, ''))
          }
        }
        throw error
      } finally {
        const remaining = (waiters.get(ptyId) ?? 1) - 1
        if (remaining > 0) {
          waiters.set(ptyId, remaining)
        } else {
          waiters.delete(ptyId)
        }
      }
      forgetPassedWhileOwned(ptyId)
      if (completion.exitCode === 0) {
        startWatch(ptyId, '', { provenByWaiter: true })
      }
      return completion
    },

    /** A reattached PTY whose restored screen ends with a pre-nonce observed setup that passed. */
    checkReattached(ptyId: string, screen: string | undefined): void {
      const seed = screen ? buildRestoredTerminalTailSeed(screen) : null
      if (!seed || ownedByWaiter(ptyId)) {
        return
      }
      // The restored screen already shows the shell back at its prompt.
      if (readIdleSetupTerminalOutcome([...seed.lines, seed.partialLine]) === 'succeeded') {
        startWatch(ptyId, '', { commandEnded: true })
      }
    }
  }
}

/** Where the first success line naming a nonce this process minted ends, consuming that nonce; -1 if none. */
function findOwnSuccessLineEnd(text: string, consumeRunNonce: (nonce: string) => boolean): number {
  if (!text.includes(SETUP_RUNNER_SUCCESS_MARKER)) {
    return -1
  }
  for (const match of text.matchAll(RUN_SUCCESS_LINE)) {
    if (consumeRunNonce(match[1])) {
      return match.index + match[0].length
    }
  }
  return -1
}

/** The tail to carry when the chunk may end inside a success line, with room to see its line start. */
function pendingSuccessLine(text: string): string | null {
  const markerAt = text.lastIndexOf(SETUP_RUNNER_SUCCESS_MARKER)
  if (markerAt !== -1 && text.length - markerAt < RUN_SUCCESS_LINE_LENGTH) {
    return text.slice(Math.max(0, markerAt - LINE_START_SLACK))
  }
  const length = markerPrefixSuffixLength(text)
  return length > 0 ? text.slice(Math.max(0, text.length - length - LINE_START_SLACK)) : null
}

function markerPrefixSuffixLength(text: string): number {
  if (!SETUP_RUNNER_SUCCESS_MARKER.includes(text.at(-1) ?? '')) {
    return 0
  }
  const max = Math.min(text.length, SETUP_RUNNER_SUCCESS_MARKER.length - 1)
  for (let length = max; length > 0; length -= 1) {
    if (SETUP_RUNNER_SUCCESS_MARKER.startsWith(text.slice(text.length - length))) {
      return length
    }
  }
  return 0
}
