// JSON so the dev launcher (.mjs) reads the same name without a type-stripping warning.
import tmwkProductName from './tmwk-product-name.json'

// The name people read (brand plan D42) and appName (D55); userData and `orca` stay.
export const TMWK_PRODUCT_NAME: string = tmwkProductName.productName

export const TMWK_REPO = 'tmwkdev/tmwk-app'
export const TMWK_REPO_URL = `https://github.com/${TMWK_REPO}`

export const TMWK_SHOW_UPSTREAM_COMMUNITY_LINKS = false
