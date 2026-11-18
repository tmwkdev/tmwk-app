import { runMainSessionOperation } from '../main-session/main-session-operations'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { ensureMainSession } from '../main-session/ensure-main-session'
import { pickMainAgent } from '../main-session/main-agent-selection'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { ensureTmwkMainHome } from './ensure-main-home'
import { startAutomaticRollover } from '../rollover/automatic-rollover-trigger'
import { startPresenceTracking } from '../presence/presence-tracker'
import { startMainSessionTurns } from '../rollover/main-session-turns'
import { trackFlushDue } from '../rollover/standing-rules-flush'
import { startContextRefreshTrigger } from '../summary/context-refresh-trigger'
import {
  refreshTicketSnapshots,
  startTicketSnapshotRefresh
} from '../tickets/refresh-ticket-snapshots'
import { isTmwkHomeHost } from './home-host'

const started = new WeakMap<OrcaRuntimeService, Promise<void>>()

/** Memoized per runtime; never rejects, so a bad home cannot block host startup. */
export function startTmwkMainHome(runtime: OrcaRuntimeService): Promise<void> {
  const existing = started.get(runtime)
  if (existing) {
    return existing
  }
  const run = runMainSessionOperation(runtime, () => bootstrap(runtime)).catch((error: unknown) =>
    console.error('[tmwk] main home bootstrap failed:', error)
  )
  started.set(runtime, run)
  return run
}

async function bootstrap(runtime: OrcaRuntimeService): Promise<void> {
  if (!isTmwkHomeHost()) {
    return
  }
  const rpc = createTmwkRpc(runtime)
  const home = await ensureTmwkMainHome(rpc)
  if (home) {
    const pin = await ensureMainSession({
      rpc,
      home,
      pickAgent: () => pickMainAgent(runtime, home.paths.mainHome),
      refreshTickets: () => refreshTicketSnapshots(runtime)
    })
    if (pin) {
      startMainSessionTurns(runtime, home.paths.sessionRecord)
      trackFlushDue(runtime)
      startContextRefreshTrigger(runtime)
      startTicketSnapshotRefresh(runtime)
      startAutomaticRollover(runtime, home)
      startPresenceTracking(runtime)
    }
  }
}
