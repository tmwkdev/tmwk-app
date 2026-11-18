/** `TMWK_HOME_HOST=1` marks a host as home. A desktop is home unless `0`; headless orcad only when `1`. */
export function isTmwkHomeHost(
  env: NodeJS.ProcessEnv = process.env,
  isElectronHost: boolean = Boolean(process.versions.electron)
): boolean {
  if (env.TMWK_HOME_HOST === '1') {
    return true
  }
  return isElectronHost && env.TMWK_HOME_HOST !== '0'
}
