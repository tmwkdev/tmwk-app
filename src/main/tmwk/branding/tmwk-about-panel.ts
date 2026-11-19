// Upstream credit (brand plan D50); not translated, so the brand pass cannot rename it.
export const TMWK_UPSTREAM_CREDIT = 'Built on Orca (MIT, © Lovecast Inc.)'

/** Adds the upstream credit; Linux has no `credits` field, so it joins the status in `copyright`. */
export function withTmwkAboutCredit(
  options: Electron.AboutPanelOptionsOptions,
  platform: NodeJS.Platform
): Electron.AboutPanelOptionsOptions {
  if (platform === 'linux') {
    const status = options.copyright
    return {
      ...options,
      copyright: status ? `${status}\n${TMWK_UPSTREAM_CREDIT}` : TMWK_UPSTREAM_CREDIT
    }
  }
  return { ...options, copyright: TMWK_UPSTREAM_CREDIT }
}
