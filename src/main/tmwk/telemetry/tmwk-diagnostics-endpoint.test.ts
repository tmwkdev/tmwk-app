import { describe, expect, it } from 'vitest'
import { tmwkDiagnosticsEndpoint } from './tmwk-diagnostics-endpoint'

describe('tmwkDiagnosticsEndpoint', () => {
  it("drops Orca's diagnostics servers", () => {
    expect(tmwkDiagnosticsEndpoint('https://orca.dev/diagnostics/token')).toBeNull()
    expect(tmwkDiagnosticsEndpoint('https://api.onorca.dev/diagnostics/token')).toBeNull()
  })

  it('keeps an endpoint tmwk configures', () => {
    expect(tmwkDiagnosticsEndpoint('https://diagnostics.tmwk.test/token')).toBe(
      'https://diagnostics.tmwk.test/token'
    )
  })
})
