import { isTmwkHomeHost } from '../main-home/home-host'

// The dispatcher maps unknown error codes to runtime_error, so the code leads the message for the CLI to recover.
export function requireTmwkHomeHost(): void {
  if (!isTmwkHomeHost()) {
    throw new Error(
      'tmwk_not_home_host: this runtime is not the tmwk home host. Pass --environment to target the home host.'
    )
  }
}
