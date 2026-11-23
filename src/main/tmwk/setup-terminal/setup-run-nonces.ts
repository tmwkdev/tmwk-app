import { randomUUID } from 'node:crypto'

// A setup can wait hours on a slow install; older entries and overflow are dropped oldest first.
const NONCE_TTL_MS = 12 * 60 * 60 * 1000
const MAX_NONCES = 512

const issuedAt = new Map<string, number>()

/** A nonce for one setup run; only this process's runs can close a terminal. */
export function mintSetupRunNonce(now = Date.now()): string {
  const nonce = randomUUID()
  issuedAt.set(nonce, now)
  for (const [oldest, at] of issuedAt) {
    if (issuedAt.size <= MAX_NONCES && now - at < NONCE_TTL_MS) {
      break
    }
    issuedAt.delete(oldest)
  }
  return nonce
}

/** True once per minted, unexpired nonce, so replayed or repainted output never matches again. */
export function consumeSetupRunNonce(nonce: string, now = Date.now()): boolean {
  const at = issuedAt.get(nonce)
  issuedAt.delete(nonce)
  return at !== undefined && now - at < NONCE_TTL_MS
}
