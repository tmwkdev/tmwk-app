# tmwk nightly

This runs the nightly checks on the always-on MBP. The plan, with the reasons behind it, is [docs/tmwk/local-ci-plan.md](../../../docs/tmwk/local-ci-plan.md).

- **Install or update:** `config/tmwk/local-ci/install.sh [<ref>]`. It sets up `~/ci/tmwk-app.git` (a bare clone of the branches, plus a fetch-only `upstream` remote for `stablyai/orca`), `~/ci/runner` (the checkout that launchd runs this script from, `main` by default) and two LaunchAgents:
  - `dev.tmwk.nightly` runs every night at 00:30 local time.
  - `dev.tmwk.nightly-deliver` runs every 30 minutes and delivers queued tickets.
- **Run now:** `launchctl kickstart gui/$(id -u)/dev.tmwk.nightly`.
- **Latest result:** `~/ci/runner/config/tmwk/local-ci/nightly.sh status`, or `status <run>` for an older run. Logs are in `~/ci/nightly/runs/<run>/`.
- **Turn it off:**
  - For a while: `launchctl bootout gui/$(id -u)/dev.tmwk.nightly`.
  - For good: `install.sh --uninstall`, which removes both agents and leaves `~/ci` in place.
- **Tickets:** to have them reach the main chat, pair the MBP with the home host (`orca environment add`). Then write `TMWK_HOME_ENV=<environment name>` to `~/ci/nightly/config`. Until then, a red night goes to the `Nightly: main is red` GitHub issue.
- **Testing the report path:** set `NIGHTLY_FORCE=1` to run even though `main` has not moved, or `NIGHTLY_FORCE_FAIL=1` to force a red night.

For branch verification, run `NIGHTLY_REF=<pushed branch> NIGHTLY_FORCE=1 config/tmwk/local-ci/nightly.sh run`. It runs every step and posts the branch commit status without changing main’s baseline, fallback issue, or ticket outbox. Stable upstream tags are fetched read-only for cross-version tests; matching Chromium headless shell and WebKit are installed during the install step.

The MBP uses GNU Bash 5.3.20 at `~/ci/tools/bash-5.3.20/bin` for shell-contract tests (Apple Bash 3.2 lacks `mapfile`). `~/ci/nightly/config` exports that directory on `PATH` and canonical `TMPDIR=/private/tmp`; canonical paths keep macOS filesystem watchers and packaged CLI path comparisons consistent. Pairing is deferred by the owner; leave `TMWK_HOME_ENV` unset and keep the GitHub fallback and queued outbox.
