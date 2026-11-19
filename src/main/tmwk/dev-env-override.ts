import { getAppEnvironment } from '../../shared/app-lifecycle/app-environment'

/** Tuning variables apply only unpackaged or under E2E, so a packaged app ignores them. */
export function readDevEnvOverride(
  name: string,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return !getAppEnvironment().isPackaged() || env.ORCA_E2E_USER_DATA_DIR ? env[name] : undefined
}
