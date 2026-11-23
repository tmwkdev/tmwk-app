import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  listEnvironmentsMock,
  dispatchMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  listEnvironmentsMock: vi.fn(),
  dispatchMock: vi.fn()
}))

vi.mock('../runtime/client', async () => {
  const { createRuntimeClientModuleMock } = await import('../index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('../runtime/profile/metadata', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDefaultUserDataPath: getDefaultUserDataPathMock
}))

vi.mock('../../shared/remote-runtime/host-store/runtime-environment-store', () => ({
  listEnvironments: listEnvironmentsMock
}))

vi.mock('../dispatch/dispatch', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  dispatch: dispatchMock
}))

import { main } from '../index'
import { pairRuntimeEnvironment } from '../index-test-harness'

type Routed = { host: string | boolean | undefined; environment: string | null }

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe('--host routing for tmwk ticket start', () => {
  let routed: Routed | undefined
  const originalEnvironment = process.env.ORCA_ENVIRONMENT
  const originalPairingCode = process.env.ORCA_PAIRING_CODE

  beforeEach(() => {
    delete process.env.ORCA_ENVIRONMENT
    delete process.env.ORCA_PAIRING_CODE
    routed = undefined
    pairRuntimeEnvironment(listEnvironmentsMock, 'env-mbp', 'mbp')
    dispatchMock.mockImplementation(
      async (
        _path: string[],
        ctx: { flags: Map<string, string | boolean>; client: { environmentSelector: string } }
      ) => {
        routed = { host: ctx.flags.get('host'), environment: ctx.client.environmentSelector }
      }
    )
  })

  afterEach(() => {
    callMock.mockReset()
    dispatchMock.mockReset()
    restoreEnv('ORCA_ENVIRONMENT', originalEnvironment)
    restoreEnv('ORCA_PAIRING_CODE', originalPairingCode)
  })

  it('runs the command here and leaves --host for the owner placement', async () => {
    // A same-named SSH target made routing refuse --host mbp as ambiguous.
    callMock.mockResolvedValue({ ok: true, result: { targets: [{ id: 'ssh-1', label: 'mbp' }] } })

    await main(
      ['tmwk', 'ticket', 'start', '--goal', 'g', '--words', 'w', '--host', 'mbp', '--json'],
      '/tmp/repo'
    )

    expect(routed).toEqual({ host: 'mbp', environment: null })
  })
})
