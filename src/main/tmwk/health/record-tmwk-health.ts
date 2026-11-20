import { redactString } from '../../observability/redactor'
import { startSpan } from '../../observability/tracer'
import type { TmwkFailureKind, TmwkHealthRollover } from '../../../shared/tmwk/tmwk-health'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { createTmwkHealthStore } from './tmwk-health-store'

const MESSAGE_MAX_CHARS = 300
const TMWK_CODE = /^tmwk_([a-z0-9_]+): /

export function openTmwkHealthStore() {
  return createTmwkHealthStore(resolveMainHomePaths().storeDir)
}

function describe(error: unknown): { message: string; code?: string } {
  const raw = redactString(error instanceof Error ? error.message : String(error))
  const match = TMWK_CODE.exec(raw)
  const code = match?.[1]
  const message = (match ? raw.slice(match[0].length) : raw).trim() || 'no reason given'
  return {
    message:
      message.length > MESSAGE_MAX_CHARS ? `${message.slice(0, MESSAGE_MAX_CHARS - 1)}…` : message,
    ...(code ? { code } : {})
  }
}

/** Logs a tmwk job failure, writes it to the local trace as a failed `tmwk.<kind>` span and keeps it for the health view. Never throws; nothing leaves the machine. */
export async function recordTmwkFailure(
  kind: TmwkFailureKind,
  stage: string,
  error: unknown
): Promise<void> {
  console.error(`[tmwk] ${kind} ${stage} failed:`, error)
  const { message, code } = describe(error)
  startSpan(`tmwk.${kind}`, {
    attributes: { 'tmwk.stage': stage, ...(code ? { 'tmwk.code': code } : {}) }
  }).fail(error instanceof Error ? error : message)
  try {
    await openTmwkHealthStore().addFailure({
      kind,
      stage,
      message,
      ...(code ? { code } : {}),
      at: new Date().toISOString()
    })
  } catch (storeError) {
    console.error('[tmwk] health record not written:', storeError)
  }
}

/** A finished rollover, as a `tmwk.rollover` span and a health entry. Never throws. */
export async function recordTmwkRollover(
  summary: TmwkHealthRollover['summary'],
  attributes: Record<string, unknown>
): Promise<void> {
  startSpan('tmwk.rollover', { attributes: { 'tmwk.summary': summary, ...attributes } }).end()
  try {
    await openTmwkHealthStore().addRollover({ summary, at: new Date().toISOString() })
  } catch (storeError) {
    console.error('[tmwk] health record not written:', storeError)
  }
}
