import { randomUUID } from 'node:crypto'
import { arch as osArch, platform as osPlatform } from 'node:os'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'
import { z } from 'zod'
import type { PostHog } from 'posthog-node'
import { getAppEnvironment } from '../../../shared/app-lifecycle/app-environment'
import { TMWK_POSTHOG_HOST } from '../../../shared/tmwk/identity/tmwk-egress'
import {
  TMWK_TELEMETRY_EVENTS,
  type TmwkTelemetryEventName
} from '../../../shared/tmwk/tmwk-telemetry-events'
import { getMainHttpClient } from '../../network/http-client'
import { resolveConsent } from '../../telemetry/consent'
import type { Store } from '../../persistence/loading-store/store'
import { openTmwkHealthStore } from '../health/record-tmwk-health'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { buildTmwkCountEvents, type TmwkTelemetryEvent } from './tmwk-telemetry-report'
import {
  REPORT_INTERVAL_MS,
  readLastReportedAt,
  writeLastReportedAt
} from './tmwk-telemetry-watermark'

// Same gate as Orca's client; vitest bypasses defines through globalThis.
const BUILD_IDENTITY: 'stable' | 'rc' | null =
  typeof ORCA_BUILD_IDENTITY !== 'undefined'
    ? ORCA_BUILD_IDENTITY
    : ((globalThis as { ORCA_BUILD_IDENTITY?: 'stable' | 'rc' | null }).ORCA_BUILD_IDENTITY ?? null)
const WRITE_KEY: string | null =
  typeof ORCA_POSTHOG_WRITE_KEY !== 'undefined'
    ? ORCA_POSTHOG_WRITE_KEY
    : ((globalThis as { ORCA_POSTHOG_WRITE_KEY?: string | null }).ORCA_POSTHOG_WRITE_KEY ?? null)

const SHUTDOWN_MS = 2_000
const LOG_SENDS = process.env.TMWK_TELEMETRY_LOG === '1'

let client: PostHog | null = null
let storeRef: Store | null = null
let sessionId: string | null = null

const isEnabled = (): boolean =>
  storeRef !== null && resolveConsent(storeRef.getSettings()).effective === 'enabled'

const gunzipAsync = promisify(gunzip)
const SentBatchSchema = z.object({ batch: z.array(z.object({ event: z.string() })) })

// Log-only: the SDK gzips batches, so names are read back from the body.
async function sentEventNames(body: unknown): Promise<string> {
  try {
    const raw =
      body instanceof Blob
        ? Buffer.from(await body.arrayBuffer())
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.from(String(body))
    const text = (raw[0] === 0x1f && raw[1] === 0x8b ? await gunzipAsync(raw) : raw).toString(
      'utf8'
    )
    const parsed = SentBatchSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data.batch.map((item) => item.event).join(',') : ''
  } catch {
    return ''
  }
}

// Opt-out stops even queued events: nothing is sent unless consent is enabled at send time.
const consentGatedFetch: NonNullable<ConstructorParameters<typeof PostHog>[1]>['fetch'] = async (
  url,
  options
) => {
  if (!isEnabled()) {
    return { status: 200, text: async () => '{}', json: async () => ({}) }
  }
  const response = await getMainHttpClient().fetch(url, { ...options, credentials: 'omit' })
  if (LOG_SENDS) {
    console.log(
      `[tmwk-telemetry] POST ${new URL(url).pathname} -> ${response.status} events=${await sentEventNames(options.body)}`
    )
  }
  return response
}

async function createTmwkPostHogClient(writeKey: string): Promise<PostHog> {
  // Load with the client; importing posthog-node at startup costs ~58ms before any window.
  const { PostHog: Sdk } = await import('posthog-node')
  return new Sdk(writeKey, {
    host: TMWK_POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10_000,
    disableGeoip: true,
    maxQueueSize: 5000,
    fetch: consentGatedFetch
  })
}

type CaptureMessage = Parameters<PostHog['capture']>[0]

/** Validates every event first, so a batch enqueues whole or not at all; false when consent is off or any is malformed. */
export function captureTmwkEvents(batch: readonly TmwkTelemetryEvent[]): boolean {
  const installId = storeRef?.getSettings().telemetry?.installId
  if (!client || !sessionId || !installId || !isEnabled()) {
    return false
  }
  const messages: CaptureMessage[] = []
  for (const { event, props } of batch) {
    const properties = TMWK_TELEMETRY_EVENTS[event].safeParse({
      app_version: getAppEnvironment().getVersion(),
      platform: osPlatform(),
      arch: osArch(),
      session_id: sessionId,
      ...props,
      $process_person_profile: false
    })
    if (!properties.success) {
      return false
    }
    messages.push({ distinctId: installId, event, properties: properties.data })
  }
  for (const message of messages) {
    client.capture(message)
  }
  return true
}

export const captureTmwkEvent = (
  event: TmwkTelemetryEventName,
  props: Record<string, unknown>
): boolean => captureTmwkEvents([{ event, props }])

async function reportCounts(now: number): Promise<void> {
  const last = await readLastReportedAt()
  if (last !== null && now - last < REPORT_INTERVAL_MS) {
    return
  }
  const since = last ?? now - REPORT_INTERVAL_MS
  const [events, { records }] = await Promise.all([
    openTmwkHealthStore().list(),
    openTmwkTicketStore().records()
  ])
  const batch: TmwkTelemetryEvent[] = buildTmwkCountEvents(events, records, since)
  if (captureTmwkEvents(batch)) {
    await writeLastReportedAt(now)
  }
}

async function startClient(key: string): Promise<void> {
  if (client) {
    return
  }
  sessionId = randomUUID()
  client = await createTmwkPostHogClient(key)
  captureTmwkEvent('tmwk_app_opened', {})
  await reportCounts(Date.now())
}

export function initTmwkTelemetry(store: Store, scheduleStart: (start: () => void) => void): void {
  try {
    storeRef = store
    if ((BUILD_IDENTITY !== 'stable' && BUILD_IDENTITY !== 'rc') || !WRITE_KEY) {
      return
    }
    const key = WRITE_KEY
    scheduleStart(() => {
      void startClient(key).catch((err) => console.warn('[tmwk-telemetry] start failed:', err))
    })
  } catch (err) {
    console.warn('[tmwk-telemetry] init failed:', err)
  }
}

export async function shutdownTmwkTelemetry(): Promise<void> {
  const instance = client
  client = null
  try {
    await instance?.shutdown(SHUTDOWN_MS)
  } catch (err) {
    console.warn('[tmwk-telemetry] shutdown error (ignored):', err)
  }
}

export function _resetTmwkTelemetryForTests(): void {
  client = null
  storeRef = null
  sessionId = null
}
