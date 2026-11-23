// Printed in two pieces so no source file or generated runner holds the line, and reading one never matches.
const MARKER_HEAD = '__TMWK_SETUP'
const MARKER_TAIL = '_SUCCEEDED__'

/** A setup run's one-shot nonce, minted by main where the runner's env is built. */
export const SETUP_RUN_NONCE_ENV = 'TMWK_SETUP_RUN_NONCE'

/** A runner prints `<marker>:<nonce>` as its last act when the setup script passed. */
export const SETUP_RUNNER_SUCCESS_MARKER = `${MARKER_HEAD}${MARKER_TAIL}`

/** Where a POSIX runner's body (the user's script, as Orca's runner always ran it) sits beside the runner. */
export function posixSetupRunnerBodyPath(runnerPath: string): string {
  return `${runnerPath.replace(/\.sh$/, '')}.body.sh`
}

/** The runner itself: runs its body as a separate script, so a heredoc the body leaves open, its `exit` or
 * its EXIT trap cannot reach this line, then prints the success line only when the body exited 0. */
export const POSIX_SETUP_RUNNER_OUTER_SCRIPT = [
  '#!/usr/bin/env bash',
  'bash "${0%.sh}.body.sh" "$@"',
  '__tmwk_setup_status=$?',
  `if [ "$__tmwk_setup_status" -eq 0 ] && [ -n "\${${SETUP_RUN_NONCE_ENV}:-}" ]; then printf '%s%s:%s\\n' '${MARKER_HEAD}' '${MARKER_TAIL}' "$${SETUP_RUN_NONCE_ENV}" || :; fi`,
  'exit "$__tmwk_setup_status"',
  ''
].join('\n')

/** `if errorlevel 1` lets negative codes (a 0xC0000005 crash) through, so check for exactly 0; the caret keeps the literal out of the file. */
export const WINDOWS_SETUP_RUNNER_SUCCESS_TAIL = `if not "%errorlevel%"=="0" exit /b %errorlevel%\r\nif defined ${SETUP_RUN_NONCE_ENV} echo ${MARKER_HEAD}^${MARKER_TAIL}:%${SETUP_RUN_NONCE_ENV}%\r\n`
