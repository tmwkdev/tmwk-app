import { hostname } from 'node:os'
import type { MainSessionRecord } from '../../../shared/tmwk/main-session-record'
import { renderSessionBriefing } from '../briefing/render-session-briefing'
import { sendMainNotice } from '../notices/send-main-notice'
import { openTmwkStore, openTmwkSummaryStore } from '../store/open-tmwk-store'
import { isRecordInEffect } from '../store/tmwk-record-store'
import { writeMainSessionPin } from './main-session-pin'
import type { TmwkRpc } from './tmwk-runtime-rpc'

/** Sends the briefing notice to the pinned session, then records `briefedAt`; a send failure leaves the pin unbriefed so bootstrap retries. */
export async function briefMainSession(
  rpc: TmwkRpc,
  pinPath: string,
  pin: MainSessionRecord,
  options: { staleSummary?: boolean } = {}
): Promise<MainSessionRecord> {
  const briefing = renderSessionBriefing({
    summary: await openTmwkSummaryStore().latest(),
    staleSummary: options.staleSummary,
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    homeHostLabel: hostname(),
    effective: (await openTmwkStore().listAll()).filter(isRecordInEffect),
    projectId: null
  })
  await sendMainNotice(rpc, pin.sessionId, { subject: 'Session briefing', body: briefing.text })
  // A failed pin write after a successful send means the next bootstrap briefs again (at-least-once).
  const briefed = { ...pin, briefedAt: new Date().toISOString() }
  writeMainSessionPin(pinPath, briefed)
  return briefed
}
