import { describe, expect, it, vi } from 'vitest'
import { createSetupTerminalAutoClose } from './setup-terminal-auto-close'

const MARKER_HEAD = '__TMWK_SETUP'
const MARKER_TAIL = '_SUCCEEDED__'
const NONCE = '7d0c2f4e-1b9a-4c3e-8f6d-2a5b9c1e0f37'
const SUCCESS_LINE = `${MARKER_HEAD}${MARKER_TAIL}:${NONCE}\r\n`
const OBSERVED = '__ORCA_SETUP_COMPLETE__:4f1c9e2a-77aa-4a51-9d7b-0c5a3a3f1b10'
const COMMAND_END_0 = '\x1b]133;D;0\x07'

// The closer only awaits resolved promises, so one macrotask lets it finish.
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function closer(
  options: {
    tokens?: string[]
    nonces?: string[]
    children?: boolean | null
    otherSurfaces?: boolean | null
    typedAt?: number
  } = {}
) {
  const tokens = new Set(options.tokens ?? [])
  const nonces = new Set(options.nonces ?? [NONCE])
  const closeTerminal = vi.fn(async (_handle: string) => undefined)
  const autoClose = createSetupTerminalAutoClose({
    hasCompletionToken: (ptyId) => tokens.has(ptyId),
    consumeRunNonce: (nonce) => nonces.delete(nonce),
    hasChildProcesses: async () => (options.children === undefined ? false : options.children),
    hasOtherSurfacesInWorktree: () =>
      options.otherSurfaces === undefined ? true : options.otherSurfaces,
    lastUserInputAt: () => options.typedAt ?? null,
    resolveHandle: (ptyId) => `term_${ptyId}`,
    closeTerminal,
    subscribeToPtyExit: () => () => {},
    delay: async () => {},
    now: () => 1_000
  })
  return { autoClose, closeTerminal, tokens }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('setup terminal auto close', () => {
  it("closes a PTY no waiter owns once it prints its own run's success line, split across chunks", async () => {
    const { autoClose, closeTerminal } = closer()
    autoClose.observe('pty-setup', `Done in 2.1s\r\n${MARKER_HEAD}`)
    autoClose.observe('pty-setup', `${MARKER_TAIL}:${NONCE}\r\n${COMMAND_END_0}`)
    await settle()
    expect(closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it('ignores a success line whose nonce this process never minted or already used', async () => {
    const { autoClose, closeTerminal } = closer({ nonces: [] })
    autoClose.observe('pty-by-hand', `\r\n${SUCCESS_LINE}`)
    const used = closer()
    used.autoClose.observe('pty-setup', `\r\n${SUCCESS_LINE}`)
    await settle()
    used.autoClose.observe('pty-replay', `\r\n${SUCCESS_LINE}`)
    await settle()
    expect(closeTerminal).not.toHaveBeenCalled()
    expect(used.closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it("reads an observed wrapper's result after the success line: 0 closes, non-zero keeps", async () => {
    const passed = closer()
    passed.autoClose.observe('pty-pass', `${SUCCESS_LINE}\r\n${OBSERVED}:0\r\n`)
    const failed = closer()
    failed.autoClose.observe('pty-fail', `${SUCCESS_LINE}\r\n${OBSERVED}:1\r\n`)
    await settle()
    expect(passed.closeTerminal.mock.calls).toEqual([['term_pty-pass']])
    expect(failed.closeTerminal).not.toHaveBeenCalled()
  })

  it('keeps a PTY whose command ends non-zero (a user EXIT trap), starts another command, or is typed into', async () => {
    const trap = closer()
    trap.autoClose.observe('pty-setup', `${SUCCESS_LINE}\x1b]133;D;3\x07`)
    const nextCommand = closer()
    nextCommand.autoClose.observe('pty-setup', `${SUCCESS_LINE}${COMMAND_END_0}`)
    nextCommand.autoClose.observe('pty-setup', '\x1b]133;C\x07')
    const typed = closer({ typedAt: 2_000 })
    typed.autoClose.observe('pty-setup', `${SUCCESS_LINE}${COMMAND_END_0}`)
    await settle()
    for (const kept of [trap, nextCommand, typed]) {
      expect(kept.closeTerminal).not.toHaveBeenCalled()
    }
  })

  it('leaves a PTY a waiter owns, by token or a wait still in flight, then closes when it reads exit 0', async () => {
    const tokened = closer({ tokens: ['pty-setup'] })
    tokened.autoClose.observe('pty-setup', SUCCESS_LINE)
    const { autoClose, closeTerminal } = closer()
    const wait = deferred<{ exitCode: number | null }>()
    const following = autoClose.followSetupWait('pty-setup', wait.promise, () => {})
    autoClose.observe('pty-setup', `${SUCCESS_LINE}${COMMAND_END_0}`)
    await settle()
    expect(tokened.closeTerminal).not.toHaveBeenCalled()
    expect(closeTerminal).not.toHaveBeenCalled()
    wait.resolve({ exitCode: 0 })
    await following
    await settle()
    expect(closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it('closes from an already printed success line when its waiter gives up', async () => {
    const { autoClose, closeTerminal, tokens } = closer({ tokens: ['pty-setup'] })
    autoClose.observe('pty-setup', SUCCESS_LINE)
    await expect(
      autoClose.followSetupWait('pty-setup', Promise.reject(new Error('aborted')), () =>
        tokens.delete('pty-setup')
      )
    ).rejects.toThrow('aborted')
    await settle()
    expect(closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it('lets a waiter close after an earlier attempt on the PTY aborted', async () => {
    const { autoClose, closeTerminal } = closer()
    autoClose.observe('pty-setup', `${SUCCESS_LINE}\x1b]133;D;3\x07`)
    await autoClose.followSetupWait('pty-setup', Promise.resolve({ exitCode: 0 }), () => {})
    await settle()
    expect(closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it('keeps a PTY with a child process; an unknown answer closes only after a waiter read exit 0', async () => {
    const background = closer({ children: true })
    background.autoClose.observe('pty-setup', SUCCESS_LINE)
    const unknown = closer({ children: null })
    unknown.autoClose.observe('pty-setup', SUCCESS_LINE)
    const proven = closer({ children: null })
    await proven.autoClose.followSetupWait('pty-setup', Promise.resolve({ exitCode: 0 }), () => {})
    await proven.autoClose.followSetupWait('pty-fail', Promise.resolve({ exitCode: 1 }), () => {})
    await settle()
    expect(background.closeTerminal).not.toHaveBeenCalled()
    expect(unknown.closeTerminal).not.toHaveBeenCalled()
    expect(proven.closeTerminal.mock.calls).toEqual([['term_pty-setup']])
  })

  it("keeps a Setup terminal that is its worktree's last surface", async () => {
    const only = closer({ otherSurfaces: false })
    only.autoClose.observe('pty-setup', SUCCESS_LINE)
    const unsure = closer({ otherSurfaces: null })
    unsure.autoClose.observe('pty-setup', SUCCESS_LINE)
    await settle()
    expect(only.closeTerminal).not.toHaveBeenCalled()
    expect(unsure.closeTerminal).not.toHaveBeenCalled()
  })

  describe('a reattached terminal', () => {
    it('closes after a pre-nonce observed setup passed, under a single-line prompt', async () => {
      const { autoClose, closeTerminal } = closer()
      autoClose.checkReattached('pty-old', `Done in 2.1s\r\n\r\n${OBSERVED}:0\r\n\r\n➜  x git:(x) `)
      await settle()
      expect(closeTerminal.mock.calls).toEqual([['term_pty-old']])
    })

    it('keeps a screen showing only a nonce success line, which any text could print', async () => {
      const { autoClose, closeTerminal } = closer()
      autoClose.checkReattached('pty-plain', `${MARKER_HEAD}${MARKER_TAIL}:${NONCE}\r\n$ `)
      await settle()
      expect(closeTerminal).not.toHaveBeenCalled()
    })

    it('keeps a failed observed setup or a command run since', async () => {
      const failed = closer()
      failed.autoClose.checkReattached('pty-failed', `ERR_PNPM_FETCH_404\r\n${OBSERVED}:3\r\n$ `)
      const ranSince = closer()
      ranSince.autoClose.checkReattached('pty-used', `${OBSERVED}:0\r\n$ cd src\r\n$ `)
      await settle()
      expect(failed.closeTerminal).not.toHaveBeenCalled()
      expect(ranSince.closeTerminal).not.toHaveBeenCalled()
    })
  })
})
