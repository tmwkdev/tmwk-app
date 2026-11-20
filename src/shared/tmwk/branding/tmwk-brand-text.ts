import { TMWK_PRODUCT_NAME } from './tmwk-product-name'

// Strings that honestly name upstream's sites, services or catalogs (brand plan D47).
export const TMWK_BRAND_KEEP_KEYS: ReadonlySet<string> = new Set([
  // Reserved ids and the safety list belong to upstream's plugin catalog.
  'auto.components.settings.pluginError.installReservedIdentity',
  'auto.components.settings.PluginMarketplaceListingRow.blocked',
  // Skill share links live on app.orca.dev.
  'auto.components.skills.SkillInstallReviewContent.93eb0fe8c7',
  'auto.components.skills.install.enterShareLink'
])

// Whole-word, case-sensitive: `orca` commands, paths and `ORCA_*` names stay. Upstream's own
// products (the store app, relay, cloud sign-in) keep their names (D52).
const ORCA_PRODUCT_NAME = /\bOrca\b(?! (?:Mobile|Relay|Cloud|[Aa]ccount)\b)/g
const UPSTREAM_PRODUCT = /\bOrca (?:Mobile|Relay|Cloud|[Aa]ccount)\b/

/** `english` is the call site's English text; it shows when a locale translated an upstream product's name. */
export function brandTmwkText(key: string, value: string, english: string = value): string {
  if (!value.includes('Orca') || TMWK_BRAND_KEEP_KEYS.has(key)) {
    return value
  }
  if (UPSTREAM_PRODUCT.test(english) && !UPSTREAM_PRODUCT.test(value)) {
    return value
  }
  return value.replace(ORCA_PRODUCT_NAME, TMWK_PRODUCT_NAME)
}

// Off under Vitest so upstream's tests of its own copy pass unedited; brandTmwkText is tested directly.
const BRAND_PASS_ACTIVE = typeof process === 'undefined' || process.env.VITEST !== 'true'

/** The translator's seam: brands a finished translation. */
export function brandTranslatedText(key: string, value: string, english: string): string {
  return BRAND_PASS_ACTIVE ? brandTmwkText(key, value, english) : value
}
