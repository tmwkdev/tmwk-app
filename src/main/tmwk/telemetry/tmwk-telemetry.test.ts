import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TmwkHealthEvent } from '../../../shared/tmwk/tmwk-health'
import type { TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import { buildTmwkCountEvents } from './tmwk-telemetry-report'

type SdkOptions = { fetch: (url: string, init: { body: string }) => Promise<{ status: number }> }
type Captured = { event: string; properties: Record<string, unknown> }
const sdk = vi.hoisted(() => ({
  ctor: vi.fn((_key: string, _options: SdkOptions) => {}),
  capture: vi.fn((_message: Captured) => {}),
  shutdown: vi.fn(async () => {})
}))
const http = vi.hoisted(() => ({ fetch: vi.fn(async () => ({ status: 200 })) }))
vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor(key: string, options: SdkOptions) {
      sdk.ctor(key, options)
    }
    capture = sdk.capture
    shutdown = sdk.shutdown
  }
}))
vi.mock('../../network/http-client', () => ({ getMainHttpClient: () => http }))
vi.mock('../../../shared/app-lifecycle/app-environment', () => ({
  getAppEnvironment: () => ({ getVersion: () => '1.2.3' })
}))
vi.mock('../health/record-tmwk-health', () => ({
  openTmwkHealthStore: () => ({ list: async () => [] })
}))
vi.mock('../store/open-tmwk-store', () => ({
  openTmwkTicketStore: () => ({ records: async () => ({ records: [] }) })
}))
vi.mock('./tmwk-telemetry-watermark', () => ({
  REPORT_INTERVAL_MS: 86_400_000,
  readLastReportedAt: async () => null,
  writeLastReportedAt: async () => {}
}))

const INSTALL_ID = '11111111-1111-4111-8111-111111111111'
const AT = '2026-11-20T12:00:00.000Z'

function releaseBuild(identity: 'stable' | 'rc'): void {
  vi.stubGlobal('ORCA_BUILD_IDENTITY', identity)
  vi.stubGlobal('ORCA_POSTHOG_WRITE_KEY', 'phc_fake')
}

function fakeStore(optedIn: boolean) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the client only reads settings.telemetry
  return {
    getSettings: () => ({ telemetry: { optedIn, installId: INSTALL_ID } })
  } as never
}

async function loadClient() {
  vi.resetModules()
  return import('./tmwk-posthog-client')
}

beforeEach(() => {
  sdk.ctor.mockClear()
  sdk.capture.mockClear()
  http.fetch.mockClear()
  for (const name of ['DO_NOT_TRACK', 'CI', 'GITHUB_ACTIONS']) {
    vi.stubEnv(name, '')
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('tmwk telemetry', () => {
  it("never sends Orca's events when a key is baked in", async () => {
    releaseBuild('stable')
    vi.resetModules()
    const orca = await import('../../telemetry/client')
    orca.initTelemetry(fakeStore(true), (start) => start())
    expect(orca.track('telemetry_opted_in', { via: 'settings' })).toBe(false)
    expect(sdk.ctor).not.toHaveBeenCalled()
  })

  it('creates no client in a dev build', async () => {
    const mod = await loadClient()
    const start = vi.fn()
    mod.initTmwkTelemetry(fakeStore(true), start)
    expect(start).not.toHaveBeenCalled()
    expect(sdk.ctor).not.toHaveBeenCalled()
  })

  it('stops sending after opt-out, even for queued events', async () => {
    releaseBuild('stable')
    const mod = await loadClient()
    mod.initTmwkTelemetry(fakeStore(false), (start) => start())
    await vi.waitFor(() => expect(sdk.ctor).toHaveBeenCalled())
    expect(mod.captureTmwkEvent('tmwk_app_opened', {})).toBe(false)
    expect(sdk.capture).not.toHaveBeenCalled()
    const options = sdk.ctor.mock.calls[0][1]
    expect((await options.fetch('https://x.test/batch/', { body: '{}' })).status).toBe(200)
    expect(http.fetch).not.toHaveBeenCalled()
  })

  it('stops sending under DO_NOT_TRACK', async () => {
    releaseBuild('rc')
    vi.stubEnv('DO_NOT_TRACK', '1')
    const mod = await loadClient()
    mod.initTmwkTelemetry(fakeStore(true), (start) => start())
    await vi.waitFor(() => expect(sdk.ctor).toHaveBeenCalled())
    expect(mod.captureTmwkEvent('tmwk_app_opened', {})).toBe(false)
    expect(sdk.capture).not.toHaveBeenCalled()
  })

  it('sends only the expected keys and no personal data', async () => {
    releaseBuild('stable')
    const mod = await loadClient()
    mod.initTmwkTelemetry(fakeStore(true), (start) => start())
    await vi.waitFor(() => expect(sdk.ctor).toHaveBeenCalled())
    const failure = (kind: 'summary' | 'rollover'): TmwkHealthEvent => ({
      type: 'failure',
      kind,
      stage: 'secret-stage-name',
      message: 'ana@example.com failed in /Users/ana/code/acme-billing on host ana-mbp.local',
      code: 'x',
      at: AT,
      repeats: 3
    })
    const events: TmwkHealthEvent[] = [
      failure('summary'),
      failure('rollover'),
      { type: 'rollover', summary: 'stored', at: AT }
    ]
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: countTicketOutcomes reads only kind and attempts
    const records = [
      {
        kind: 'task',
        attempts: [{ outcome: 'completed', settledAt: AT, observed: { completedAt: AT } }]
      }
    ] as unknown as TmwkTicketRecord[]
    for (const item of buildTmwkCountEvents(events, records, 0)) {
      mod.captureTmwkEvent(item.event, item.props)
    }
    const calls = sdk.capture.mock.calls.map(([message]) => message)
    expect(calls.map((c) => c.event)).toEqual([
      'tmwk_app_opened',
      'tmwk_errors_counted',
      'tmwk_errors_counted',
      'tmwk_rollovers_counted',
      'tmwk_ticket_outcomes_counted'
    ])
    const wire = JSON.stringify(calls)
    for (const secret of [
      'ana@example.com',
      '/Users/ana',
      'ana-mbp',
      'acme-billing',
      'secret-stage'
    ]) {
      expect(wire).not.toContain(secret)
    }
    expect(Object.keys(calls[1].properties).toSorted()).toEqual([
      '$process_person_profile',
      'app_version',
      'arch',
      'count',
      'kind',
      'platform',
      'session_id'
    ])
    expect(calls[1].properties).toMatchObject({ kind: 'rollover', count: 3 })
  })
})
