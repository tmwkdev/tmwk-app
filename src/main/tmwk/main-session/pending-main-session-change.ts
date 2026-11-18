import type { MainSessionPending } from '../../../shared/tmwk/main-session-switch'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'

const pending = new WeakMap<OrcaRuntimeService, MainSessionPending>()
const failures = new WeakMap<OrcaRuntimeService, string>()

export function readPendingMainSessionChange(
  runtime: OrcaRuntimeService
): MainSessionPending | null {
  return pending.get(runtime) ?? null
}

export function markPendingMainSessionChange(
  runtime: OrcaRuntimeService,
  change: MainSessionPending
): void {
  pending.set(runtime, change)
  failures.delete(runtime)
}

export function clearPendingMainSessionChange(runtime: OrcaRuntimeService): void {
  pending.delete(runtime)
}

export function recordMainSessionChangeFailure(runtime: OrcaRuntimeService, message: string): void {
  failures.set(runtime, message)
}

export function readMainSessionChangeFailure(runtime: OrcaRuntimeService): string | undefined {
  return failures.get(runtime)
}
