// The paired-server link failing, not the host answering.
const TRANSPORT_ERROR_CODES: ReadonlySet<string> = new Set([
  'runtime_timeout',
  'runtime_unavailable',
  'remote_runtime_unavailable',
  'remote_link_closed',
  'server_pairing_changed',
  'runtime_environment_changed',
  'server_required'
])

export function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : null
}

/** An error with no code counts as the link failing too. */
export function isServerLinkFailure(error: unknown): boolean {
  const code = errorCode(error)
  return typeof code !== 'string' || TRANSPORT_ERROR_CODES.has(code)
}
