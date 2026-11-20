import { TMWK_EGRESS } from '../../../shared/tmwk/identity/tmwk-egress'

/** S22: drops a diagnostics endpoint on a blocked host, whether a build constant or env named it. */
export function tmwkDiagnosticsEndpoint(endpoint: string | null): string | null {
  if (endpoint === null) {
    return null
  }
  let host: string
  try {
    host = new URL(endpoint).hostname.toLowerCase()
  } catch {
    return null
  }
  return TMWK_EGRESS.diagnostics.blockedHosts.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  )
    ? null
    : endpoint
}
