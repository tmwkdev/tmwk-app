import { describe, expect, it } from 'vitest'
import { brandTmwkText } from './tmwk-brand-text'

describe('brandTmwkText', () => {
  it('replaces the product name as a whole, case-sensitive word', () => {
    expect(brandTmwkText('k', 'About Orca')).toBe('About tmwk')
    expect(brandTmwkText('k', "Orca's server")).toBe("tmwk's server")
    expect(brandTmwkText('k', 'Restart Orca’s server')).toBe('Restart tmwk’s server')
  })

  it('keeps identifiers, other words and upstream product names', () => {
    for (const text of ['orca tmwk brief', 'ORCA_USER_DATA_PATH', 'Orcas', 'Install Orca Mobile']) {
      expect(brandTmwkText('k', text)).toBe(text)
    }
    expect(brandTmwkText('k', 'Orca Relay and Orca')).toBe('Orca Relay and tmwk')
    expect(brandTmwkText('k', 'Orca モバイルを開く', 'Open Orca Mobile')).toBe(
      'Orca モバイルを開く'
    )
    expect(brandTmwkText('k', 'Orca-Server neu starten', 'Restart Orca server')).toBe(
      'tmwk-Server neu starten'
    )
  })

  it('keeps strings on the keep-list', () => {
    const key = 'auto.components.settings.PluginMarketplaceListingRow.blocked'
    expect(brandTmwkText(key, 'Blocked by Orca')).toBe('Blocked by Orca')
  })
})
