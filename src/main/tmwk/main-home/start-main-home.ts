import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { ensureMainSession } from '../main-session/ensure-main-session'
import { pickMainAgent } from '../main-session/main-agent-selection'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { ensureTmwkMainHome } from './ensure-main-home'
import { isTmwkHomeHost } from './home-host'

const started = new WeakMap<OrcaRuntimeService, Promise<void>>()

/** Memoized per runtime; never rejects, so a bad home cannot block host startup. */
export function startTmwkMainHome(runtime: OrcaRuntimeService): Promise<void> {
  const existing = started.get(runtime)
  if (existing) {
    return existing
  }
  const run = bootstrap(runtime).catch((error: unknown) =>
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
    await ensureMainSession({
      rpc,
      home,
      pickAgent: () => pickMainAgent(runtime, home.paths.mainHome)
    })
  }
}
