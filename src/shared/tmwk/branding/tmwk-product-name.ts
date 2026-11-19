// JSON so the dev launcher (.mjs) reads the same name without a type-stripping warning.
import tmwkProductName from './tmwk-product-name.json'

// The name people read (brand plan D42); identifiers such as appName, userData and `orca` stay.
export const TMWK_PRODUCT_NAME: string = tmwkProductName.productName
