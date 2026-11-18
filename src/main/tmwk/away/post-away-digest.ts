import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { runMainSessionOperation } from '../main-session/main-session-operations'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { sendMainNotice } from '../notices/send-main-notice'
import { openTmwkPresenceStore } from '../store/open-tmwk-store'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { computeAwayDigest } from './compute-away-digest'

const chains = new WeakMap<OrcaRuntimeService, Promise<unknown>>()

async function post(runtime: OrcaRuntimeService, awaySince: string): Promise<boolean> {
  const pin = await readMainSessionPin(resolveMainHomePaths().sessionRecord)
  if (!pin) {
    return false
  }
  await refreshTicketSnapshots(runtime)
  const store = openTmwkPresenceStore()
  const state = await store.read()
  const { text, version } = await computeAwayDigest({
    digestVersion: state?.digestVersion ?? 0,
    awaySince
  })
  if (text !== null) {
    await sendMainNotice(createTmwkRpc(runtime), pin.sessionId, {
      subject: 'While you were away',
      body: text
    })
  }
  await store.update(
    async () => version,
    (current) => ({
      state: { ...current, digestVersion: Math.max(current.digestVersion, version) },
      result: undefined
    })
  )
  return true
}

/** One post at a time per runtime, queued behind any rollover or switch so it reaches the new session. Resolves false when no session is pinned yet. A failed send leaves `digestVersion` so the next return covers the same changes. */
export function postAwayDigest(runtime: OrcaRuntimeService, awaySince: string): Promise<boolean> {
  const run = (chains.get(runtime) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => runMainSessionOperation(runtime, () => post(runtime, awaySince)))
  chains.set(runtime, run)
  return run
}
