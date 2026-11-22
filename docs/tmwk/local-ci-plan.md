# Local CI and releases: nightly checks and Mac releases on our own machines

Status: **the nightly is running on the MBP** (phases 1 and 2, set up 2026-11-20 after the owner's go). Its scripts are in PR #54, and the [first run](#first-run-2026-11-20) is recorded below. Ticket delivery (phase 3) waits on pairing the MBP with the Air (M3). Releases (phase 4) are not started. This file **replaces** the earlier version (the 2026-11-18 "run checks on the always-on MacBook Pro" proposal). That plan's measurements are kept below. Its per-PR gate and PR poller are dropped, because the owner decided against gating merges.

Machine facts were observed on the MBP and over `ssh pve` on 2026-11-20. The MacBook Air was not observed from here; what this plan says about it comes from the owner. Repo facts come from reading `origin/main` at `556813aa33`. Nothing was installed, scheduled, stored or run on either machine for this plan. Items marked **(verify)** were read but not run.

The point is the same as the product's: keep Orca's machinery, and make it simple to live with. One job runs at night, a red night shows up as a ticket under Needs you, and one script on your laptop cuts a release.

## Decisions already made (owner)

1. GitHub Actions stays off on `tmwkdev/tmwk-app`, to save cost. The API agrees: `actions/permissions` returns `enabled: false`.
2. **Merges are not gated on CI.** Main only has to stay semi-stable until real releases are cut from it.
3. A **nightly job** runs once a night against the latest `main`, at about 00:30 America/Chicago.
4. Releases run locally, never in Actions. That covers building, Developer ID signing, notarization (once Apple enrollment completes) and publishing to `tmwkdev/tmwk-app` GitHub Releases. v0 is a **macOS-only beta**: version `0.1.0`, bundle id `dev.tmwk.app`. Windows and Linux are not tested for v0.

Decided 2026-11-20, answering this plan's first draft:

5. **Releases are built, boot-checked, signed and published on the MacBook Air** (Apple Silicon, the home host). The signing secrets live there, not on the MBP. The nightly stays on the MBP.
6. **The SSH-host server template ships with the slots we can build locally:** `darwin-arm64` and `darwin-x64` on the Air, `linux-x64-glibc` and `linux-x64-musl` on a homelab VM.
7. **Beta labeling:** a normal (not pre-) release titled "tmwk 0.1.0 (beta)".
8. **Telemetry is off for v0.** [telemetry-plan.md](telemetry-plan.md) (#53) covers what tmwk needs later, and #59 made feedback and crash reports send nothing to Orca.
9. **Any failing nightly step creates a ticket.**
10. **Packaging (`build:mac`) runs every night.**

## What is already there

### On the MBP (observed 2026-11-20)

| Item              | Observed                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host              | `tys-MacBook-Pro.local`, macOS 26.7.1 (25G241), up 46 days, timezone `America/Chicago`                                                                                                                                                                                                                                                                                                                                     |
| CPU / RAM / disk  | Intel i7-1068NG7, **x86_64**, 8 logical cores. 32 GiB RAM. 346 GiB free of 466 GiB                                                                                                                                                                                                                                                                                                                                         |
| Load              | **Load average 23 at 10:09**, from agent workers running in Orca. Treat the machine as busy at any hour, not as an idle server                                                                                                                                                                                                                                                                                             |
| Awake             | `sleep 0`, held by `caffeinate`. The LaunchAgent `com.local.ssh-awake` (`/usr/bin/caffeinate -s`, `RunAtLoad`, `KeepAlive`) is loaded. `womp 1`                                                                                                                                                                                                                                                                            |
| Toolchain         | `~/.zshenv` loads nvm for every zsh, interactive or not. Node **v24.22.1** (`~/.nvm/versions/node/v24.22.1`; v24.18.0 is still installed). pnpm 12.14.0 at `~/Library/pnpm/bin/pnpm`, which matches `packageManager`. bun 1.4.4. gh 2.96.0. Xcode Command Line Tools 26.6, with `xcrun notarytool` and `xcrun stapler`. Homebrew. No full Xcode, docker, tailscale or 1Password CLI (`op`); the 1Password app is installed |
| `~/.zshenv` drift | Its PATH loop still lists `~/.nvm/versions/node/v24.18.0/bin`. That is harmless while nvm loads first, but launchd jobs should not depend on it                                                                                                                                                                                                                                                                            |
| gh                | Logged in as `tykowale`. The token is stored in `~/.config/gh/hosts.yml`, so a launchd job can read it without a keychain prompt. Scopes: `gist`, `read:org`, `repo`, `workflow`                                                                                                                                                                                                                                           |
| git over ssh      | `~/.ssh/id_ed25519` has no passphrase, so `git fetch` works unattended. No ssh-agent is running in non-interactive shells                                                                                                                                                                                                                                                                                                  |
| Checkouts         | `~/tmwk-ssh-target/tmwk-app` is the clone that agents use. `orca-dev` links into it (`/usr/local/bin/orca-dev` → `.../config/scripts/development/launch/orca-dev.mjs`), and Orca worktrees hang off it. **CI must never touch it.** `~/ci` (3.5 GiB) holds the 2026-11-18 timing run: a clone at `887f5c3`, `unit-run.sh`, logs and corepack shims                                                                         |
| Launchd precedent | `~/Library/LaunchAgents/com.ty.swim-lane-booker.plist` runs `/Users/ty/.nvm/versions/node/v24.18.0/bin/node` on a `StartCalendarInterval`. It pins a Node version path that breaks when nvm moves. The nightly job avoids that by starting through `/bin/zsh`, which sources `~/.zshenv`                                                                                                                                   |
| Signing           | `security find-identity -v -p codesigning`: **0 valid identities**. Keychains: only `login` and `System`. FileVault is on                                                                                                                                                                                                                                                                                                  |
| Orca              | `orca status`: running and reachable. `orca environment list`: **no saved environments**, so the MBP cannot yet message the MacBook Air's Orca on its own. Dispatches only arrive from the Air                                                                                                                                                                                                                             |
| sudo              | Needs a password (2026-11-18). Nothing in this plan needs root                                                                                                                                                                                                                                                                                                                                                             |

### On the homelab (observed over `ssh pve`)

Note that `ssh homelab` does not resolve; the Proxmox host is `pve`.

| Host                       | Observed                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pve` (192.168.4.10, root) | Proxmox VE 9.2.25, Intel i7-6700T, 8 threads, x86_64. 31 GiB RAM, about 11 GiB available. Load 0.1. `local-lvm` has about 163 GiB free. VMs `services`, `downloads` and `tailscale` are running; three `*-rollback` VMs are stopped |
| `services` (192.168.4.11)  | `Permission denied (publickey)` from the MBP                                                                                                                                                                                        |
| `pi` (192.168.4.20)        | Raspbian 11, armv7l, under 1 GiB of RAM. Not useful for this                                                                                                                                                                        |

### In the repo (read on `origin/main`)

- **Gates:** `pnpm check:changed` (`config/scripts/preflight/changed-checks/check-changed.mjs`) takes `--base=<ref>`, `--force`, `--maxWorkers=<n>` and `--timeout=<minutes>`. It runs the typecheck projects, related unit tests, changed-code quality, format, oxlint and per-path checks for the diff, and it keeps a pass-hash cache. `pnpm tc`, `pnpm lint` and `pnpm test` are the full forms.
- **Mobile deps:** lint and `build:mobile-web` resolve React Native from `mobile/node_modules`, which needs its own `pnpm install --frozen-lockfile` (`.github/actions/install-mobile-dependencies/action.yml`). The 2026-11-18 timing run did not do this install **(verify** whether it caused any of the 17 failures**)**.
- **Local Mac build:** `pnpm build:mac` builds an ad-hoc-signed package with no credentials (`config/scripts/desktop-distribution/macos/build-mac-local.mjs`). The dmg and zip targets build both `x64` and `arm64` (`config/electron-builder.config.cjs:718-726`). The Swift helpers build universal (`build-computer-macos.mjs:20`).
- **Release Mac build:** upstream's `.github/workflows/release-mac-build.yml` is guarded to `stablyai/orca` and runs on Blacksmith macOS runners. Its steps can run locally almost one for one: `verify-macos-release-env.mjs`, `pnpm verify:macos-entitlements`, `pnpm run build:release`, then `ORCA_MAC_RELEASE=1 node config/scripts/desktop-distribution/macos/build-mac-notarization-overlap.mjs --publish always --draft`, `gate-mac-update-manifests.mjs dist`, `assert-github-release-is-draft.mjs <tag>` and `verify-telemetry-constants.mjs`.
- **Credentials the scripts read:** `verify-macos-release-env.mjs` requires `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. `build-mac-notarization-overlap.mjs:128-134` notarizes with Apple ID and app-specific password only. It does not support an App Store Connect API key or a `notarytool` keychain profile.
- **Hard-coded upstream identity a tmwk release must override:**
  - `ORCA_MAC_TEAM_ID = '6CX3WHS9HZ'` (`config/electron-builder.config.cjs:259`) is checked against the signed terminal host (`:916`).
  - `publish` names `stablyai/orca` (`:826-831`).
  - `build-mac-notarization-overlap.mjs:124` `require()`s upstream's config by path.
  - `assert-github-release-is-draft.mjs:97` defaults to `stablyai/orca` unless `GITHUB_REPOSITORY` is set.
  - `package.json` `version` is `1.4.214`.
  - The tmwk overlay `config/tmwk/electron-builder.tmwk.cjs` does not exist yet. It is P0 of the [side-by-side install guide](side-by-side-install-guide.md) (PR #38).
- **An Intel host cannot ship the arm64 slice.** With `ORCA_MAC_RELEASE=1`, `afterPack` must boot each arch's packaged terminal host (`electron-builder.config.cjs:908-911`, `required: isMacRelease || CI === 'true'`). `macCommandPrefixForArch` (`config/scripts/desktop-distribution/runtime-verification/verify-packaged-daemon-entry.cjs:61-70`) runs x64 on arm64 through Rosetta but returns `null` for arm64 on x64. The check then throws. On the x86_64 MBP, a release build can only produce **x64**. A local, non-release `pnpm build:mac` skips the check, as long as `CI` is unset.
- **The orcad template.** Release packaging sets `ORCA_REQUIRE_ORCAD_TEMPLATE=1` (`packaged-orcad-template.cjs:42-61`). Upstream builds that template from native prebuilds made on six runner types (`node-server-tests.yml:155`: Ubuntu x64 and arm64, macOS arm64 and Intel, Windows x64 and arm64). It lets the desktop app deploy its server to SSH hosts. A local release can build only part of it (decision 6). Of the eight `SERVER_TARGETS` (`src/shared/node-runtime/node-runtime-pin.ts:4-13`), we can build `darwin-arm64`, `darwin-x64`, `linux-x64-glibc` and `linux-x64-musl`. We cannot build `linux-arm64-glibc`, `linux-arm64-musl`, `win32-arm64` or `win32-x64`.
- **A partial template builds but does not package.** `build-orcad-template.mjs --targets <subset>` accepts a subset (`requestedTemplateTargets`, `:110-124`), with the comment "Allow partial CI --targets only; shipped templates require every target." Packaging re-verifies with `verifyPackagedOrcadTemplate(resourcesDir)`, which defaults to all eight targets (`verify-packaged-orcad-template.cjs:160,191`), and is called that way at `packaged-orcad-template.cjs:161`, `compact-packaged-orcad-ripgrep.cjs:20,50` and `packaged-orcad-browser.cjs:43`. So decision 6 needs one Extend: those calls verify against the targets the manifest declares, behind a tmwk flag. **(Verify)** what the app does on an SSH host whose target has no slot. It should refuse with a clear message rather than fail midway; `src/main/orcad/artifact-slots/orcad-artifact-materializer.ts` is where to look.
- **Telemetry switch:** `src/main/telemetry/client.ts:24` is `const TELEMETRY_ENABLED = true`. `verify-telemetry-constants.mjs` skips its check when that constant is `false`, so it proves nothing for tmwk. The release instead runs tmwk's own `config/tmwk/release/verify-tmwk-telemetry-key.mjs` (#59, reworked in stage 3): every `app.asar` carries tmwk's PostHog key (by hash) and no Orca reporting endpoint.
- **Upstream release workflows** (`release-cut.yml`, `release-mac-build.yml` and the others) stay untouched (Track). With Actions off they never run here.

## Measured on the MBP (2026-11-18, kept from the earlier plan)

`pnpm test --maxWorkers=2` under `nice -n 10`, at main `887f5c3`:

- Clone: 78 s. Install (`pnpm install --frozen-lockfile`): 54 s.
- Tests: **2,782 s (46.4 min)**. 3,793 files passed, **17 failed**, 109 skipped; 16,223 tests passed, 15 failed, 435 skipped.
- The failing files include `native-process-spawn`, `release-checkout`, `process-host-dev-rebuild`, `macos-terminal-host-bundle`, `packaged-cli-assets`, `reclaim-worktree-generated-files`, `pr-auxiliary-preflight-admission` and `dependency-security-release`. bun and gh were missing then, and the mobile install was not done, so re-run before triaging.
- The other steps were first timed on 2026-11-20 ([First run](#first-run-2026-11-20)).

## First run (2026-11-20)

This was a supervised run through launchd (`launchctl kickstart gui/501/dev.tmwk.nightly`), on main `0040764`, from 11:04 to 13:10 CST. It ran on a busy MBP: the load average was 45 to 92, from codex and claude agents running their own tests at the same time. Expect shorter times at 00:30 if agents are quieter then.

| Step          | Result              | Time        | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| install       | ok                  | 36 s        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| check-changed | ok                  | 7 s         | The first night's base is the previous commit, a one-file diff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| tc            | ok                  | 36 s        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| lint          | **failed**          | 6 min 31 s  | **Real, on main:** `audit:code-quality:native` (`oxlint --deny-warnings`) reports 61 warnings, import cycles among `src/main/tmwk/**`. For example `refresh-ticket-snapshots` → `tmwk-runtime-rpc` → `rpc-method-registry` → `main-session-methods` → `start-main-home` → back                                                                                                                                                                                                                                                                                                                     |
| unit          | **failed**          | 100 min     | 3,799 files passed, 34 failed, 95 skipped (3,928); 16,240 tests passed, 20 failed. 17 of the failing files are the 2026-11-18 baseline. The 17 new are 13 mobile-web render tests, which need Playwright's `chromium-headless-shell` (not installed), and 4 untriaged (`agent-launch-at-rest`, `best-effort-socket-type-of-service`, `runner-wsl-gh-fallback`, `provider-timeline-assembler-refusal`). Among the known ones, the cross-version-wire tests need stable `vX.Y.Z` tags, which `tmwkdev/tmwk-app` does not have; use the mirror's `upstream` tags or `ORCA_CROSS_VERSION_BASELINE_REF` |
| build-mac     | **failed** (script) | 17 min 22 s | The runner's bug: packaging arm64 needs both arches' native variants (`@parcel/watcher-darwin-arm64`, `@koromix/koffi-darwin-arm64`). Fixed in PR #54: the install step is now `pnpm install:release` (`--cpu=current,x64,arm64`). Re-checked by hand right after (13:25): `install:release` 8 s, then `build:mac` passed in 7 min 56 s with `orca-macos-arm64.dmg` and `orca-macos-x64.dmg`                                                                                                                                                                                                       |

Reporting worked end to end. The commit status `tmwk/nightly` = `failure` was posted on `0040764`. The MBP is not paired with the Air yet (M3), so the ticket was queued in `~/ci/nightly/outbox/`, and the fallback issue [#60](https://github.com/tmwkdev/tmwk-app/issues/60) opened with step and file names only. The unit step's 100 minutes is close to its 120-minute limit. If nights run that slow, raise the limit rather than let the suite time out.

## The nightly job

### What it runs

It runs against the head of `origin/main` at start time, in this order. Each step writes its own log, and a failed step does not stop the later ones, so one report covers the whole night.

| #   | Step            | Command                                                                                                                             | Why                                                                                                                                                                            |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Skip check      | If `origin/main` equals `last-run-sha`, exit without reporting                                                                      | No new commits means no new information                                                                                                                                        |
| 1   | Install         | `pnpm install --frozen-lockfile` then `(cd mobile && pnpm install --frozen-lockfile)`                                               | Fresh deps against the shared pnpm store                                                                                                                                       |
| 2   | Day's diff gate | `pnpm check:changed --base=<last-green-sha> --maxWorkers=2`                                                                         | The same gate agents run before a push, applied to everything that landed since the last green night. On the first night, use `--base=HEAD~1`                                  |
| 3   | Typecheck       | `pnpm tc`                                                                                                                           | Whole-repo types; the gate in step 2 is only path-selected                                                                                                                     |
| 4   | Lint            | `pnpm lint`                                                                                                                         | The full lint gate                                                                                                                                                             |
| 5   | Unit suite      | `pnpm test --maxWorkers=2` with JSON output to the run directory **(verify** the reporter flag `run-vitest.mjs` passes through**)** | About 46 min. Reported as **new failures since last night**, so a known-bad file is not news every morning                                                                     |
| 6   | Package         | `ORCA_BACKGROUND_LAUNCH=1 pnpm build:mac` with `CI` unset, **every night** (decision 10)                                            | Proves main still packages. Ad-hoc signed; never launched. Switches to `pnpm tmwk:build:mac` once side-by-side P0 lands                                                        |
| 7   | Pre-push timing | `config/tmwk/checks/check-prepush.mjs --base=<sha>^` on each of main's last 10 non-merge commits                                    | Reports p50 and p90 for all runs and for typecheck runs only, against the 30s budget ([code-quality-plan.md](code-quality-plan.md) P0.3). Report-only: it never reds the night |

Not run: e2e (it would launch Electron on the user's logged-in desktop, which `AGENTS.md` forbids), Linux and Windows jobs, and anything that needs signing secrets. Each report says so in one line.

Expected wall time is about 1.5 to 2 hours, so the run finishes around 02:00 to 02:30. Phase 1 replaces this guess with measurements.

### Where it lives on the MBP

```
~/ci/
  tmwk-app.git/            bare mirror of git@github.com:tmwkdev/tmwk-app.git
  work/nightly/            one reused worktree, detached at the night's SHA
  nightly/
    runs/<date>-<sha7>/    one log per step, summary.json, vitest JSON
    last-run-sha           SHA of the last completed run
    last-green-sha         SHA of the last run where every step passed
    open-ticket            task id and failure signature of the open nightly ticket, if any
    outbox/                tickets not yet delivered to the Air
    previous-failed-tests.txt  failing test files of the last run, for "new" and "fixed"
    latest -> runs/<…>     the newest run
    config                 optional: TMWK_HOME_ENV=<saved orca environment of the Air>
    lock/                  created with mkdir; present while a run is active
    dev.tmwk.nightly*.log  launchd stdout and stderr
  runner/                  checkout of the scripts that launchd runs
```

The scripts live in the repo as Own code, in `config/tmwk/local-ci/` (PR #54): `nightly.sh` (`run`, `deliver`, `status`), `install.sh` (which also does `--uninstall`) and a README. That PR adds the `config/tmwk/**` row to [fork-ownership.md](fork-ownership.md). launchd runs `nightly.sh` from the `~/ci/runner` checkout, as the owner asked. That checkout stays on PR #54's branch until the PR merges. From then on, each run moves the runner to `main` once it has finished, so a change to the script takes effect the following night and never in the middle of a run.

The job is a **LaunchAgent**, not a LaunchDaemon. It runs as `ty`, has access to the gh token and the ssh key, and needs no sudo.

```xml
<key>Label</key><string>dev.tmwk.nightly</string>
<key>ProgramArguments</key>
<array><string>/bin/zsh</string><string>/Users/ty/ci/runner/config/tmwk/local-ci/nightly.sh</string><string>run</string></array>
<key>StartCalendarInterval</key>
<dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>30</integer></dict>
<key>ProcessType</key><string>Standard</string>
<key>Nice</key><integer>10</integer>
<key>LowPriorityIO</key><true/>
<key>StandardOutPath</key><string>/Users/ty/ci/nightly/dev.tmwk.nightly.log</string>
<key>StandardErrorPath</key><string>/Users/ty/ci/nightly/dev.tmwk.nightly.log</string>
```

`install.sh` writes this plist to `~/Library/LaunchAgents/`, together with `dev.tmwk.nightly-deliver`, which runs `nightly.sh deliver` every 1800 s. It then loads both with `launchctl bootstrap gui/$(id -u)`. To turn the nightly off for a while, run `launchctl bootout gui/$(id -u)/dev.tmwk.nightly`. To remove both agents, run `install.sh --uninstall`, which leaves `~/ci` in place.

launchd's calendar times are local time, so 00:30 is Chicago time, DST included. If the Mac ever sleeps through 00:30, launchd runs the job once on wake. `/bin/zsh` sources `~/.zshenv`, which loads nvm, so no Node path is pinned in the plist.

### Keeping it out of the way

- **One run at a time.** `mkdir ~/ci/nightly/lock` must succeed or the job exits. A lock older than 6 hours is treated as stale and reported.
- **Low priority.** The job runs at `Nice 10` with `LowPriorityIO`, and vitest and `check:changed` are capped at `--maxWorkers=2`. Agents keep running overnight (load was 23 mid-morning), so this matters at 00:30 too. `ProcessType Background` and `taskpolicy -b` were dropped from the first draft. Background QoS throttles hard when the machine is busy, and the 46-minute suite could run past morning.
- **Own checkout.** The job never runs in `~/tmwk-ssh-target/tmwk-app` or any Orca worktree. It never pushes and never writes to any branch.
- **No windows.** `ORCA_BACKGROUND_LAUNCH=1` is set for every step. No e2e runs, and nothing calls `open`.
- **Bounded disk.** The job prunes run directories older than 14 days. `git clean -fdx -e node_modules` runs between nights, and the pnpm store is pruned weekly (`pnpm store prune`).
- **Timeout.** Each step has a hard limit that kills its whole process tree: install 20 min, `check:changed` 60, `tc` 45, `lint` 45, unit 120, `build:mac` 90. A hang cannot hold the lock into the morning.
- **Main only.** The repo is public. The job only checks out `origin/main`, never a PR head, because it runs repo code with `ty`'s permissions, the gh token and the ssh key.

### How results reach you

**A failing step creates a tmwk ticket** in your `main` Run on the Air, so it shows in the main chat's Needs you (decision 9). A commit status records every night. A GitHub issue is the fallback when the Air cannot be reached.

**1. The ticket (on any red night).** tmwk tickets are the Tasks of every Run whose objective is `main` (`src/main/tmwk/tickets/read-live-tickets.ts:5,104-121`). A Task with status `failed` or `blocked` is classified `stop` and lands in Needs you (`src/main/tmwk/tickets/needs-me-order.ts:5-18`). From the MBP, against the Air's Orca (paired once, M8):

```sh
AIR=<saved environment name>
RUN=$(orca orchestration run-list --environment "$AIR" --json | jq -r '.runs[] | select(.objective == "main") | .id' | head -1)
TASK=$(orca orchestration task-create --environment "$AIR" --run "$RUN" \
  --task-title "Nightly red: main@<sha7> (<failing steps>)" --spec-file "$RUN_DIR/ticket.md" --json | jq -r '<task id>')
orca orchestration task-update --environment "$AIR" --run "$RUN" --id "$TASK" --status failed \
  --result "<steps failed>; logs: ssh mbp, then ~/ci/runner/config/tmwk/local-ci/nightly.sh status"
```

- **`ticket.md`** holds:
  - the failing steps
  - test files newly failing and newly fixed since the last night
  - the SHA range `last-green..sha`
  - the last 40 lines of each failing step's log
  - how to reproduce: `ssh mbp`, then `~/ci/runner/config/tmwk/local-ci/nightly.sh status <run>`

  Unlike the public GitHub issue, the ticket lives only in your Orca, so it can carry log text.

- **Retries, `--json` shape:** each call passes `--retry-request <id>`, saved in the outbox, so a retry never creates two tickets. **(Verify)** the `--json` shape of `task-create` (the `jq` path), and that a Task created this way with no worker shows as a card. `failed` is a stop whether or not it is accepted (`needs-me-order.ts:11-12`). So the card stays in Needs you until the Task is completed, reopened with `worker-start --retry-of`, or a later green night closes it.
- **One card per failure.** The failure signature is the sorted list of failing steps and new failing test files. If tonight's signature equals the one in `open-ticket`, the job updates that Task's `--result` with the new date and SHA instead of creating another card. A different signature creates a new ticket. The old one is completed with `--result "superseded by <task>"`.
- **Green night.** If `open-ticket` is set, the job completes that Task with `--status completed --result "green at <sha7>"`. That turns it into a `result` you accept once, then clears `open-ticket`.
- **If the Air is unreachable.** The Air is a laptop, so at 00:30 it may be asleep or away. The job writes the ticket to `~/ci/nightly/outbox/` and opens the GitHub issue (fallback 3) at once. A second LaunchAgent, `dev.tmwk.nightly-deliver` (`StartInterval` 1800), retries the outbox. When the ticket lands, it links the issue and closes it. If `run-list` finds no `main` Run (Runs settled for 24 h with no live coordinator are deleted, M0 finding 5), the ticket waits in the outbox the same way.
- **Your partner.** It can pick the ticket up as usual: dispatch an owner to fix main with `worker-start --retry-of <task>` (the tmwk skill's normal path).

**2. A commit status on every night's SHA:** `gh api -X POST repos/tmwkdev/tmwk-app/statuses/<sha> -f context=tmwk/nightly -f state=success|failure -f description="<n> new test failures; tc ok; lint failed"`. It shows on the commit and the main branch page; the commit statuses API works with Actions off. The release script reads it (see the [release flow](#the-release-flow-macos-beta)).

**3. Fallback: the rolling GitHub issue `Nightly: main is red`,** with a new `nightly` label. It is used only while a ticket is undelivered, so a phone notification still arrives when the Air is closed. It lists step names, test file names, the SHA range and the MBP log path. It never carries raw log text, environment or paths outside the repo, because the repo is public. A green night or a delivered ticket closes it.

On the MBP, `~/ci/runner/config/tmwk/local-ci/nightly.sh status [<run>]` prints a run's `summary.json`, and `orca` agents can read it over `ssh mbp`.

## The release flow (macOS beta)

### Where releases run

Releases run on **the MacBook Air** (Apple Silicon, decision 5). There, `afterPack` boot-checks the arm64 slice natively and the x64 slice through Rosetta (`macCommandPrefixForArch`, `verify-packaged-daemon-entry.cjs:61-70`). So one run on the Air ships both slices with the check intact. The Air must have Rosetta, Node 24 (as `engines` pins), pnpm 12.14.0, gh logged in, and Xcode Command Line Tools for `notarytool` and `stapler`. None of this was observed from here, so M5 checks it.

The homelab VM builds the Linux x64 orcad prebuilds (decision 6), and the Air pulls them in before packaging (step 5 below). The MBP builds nothing for a release. Its only role is the green `tmwk/nightly` status the release checks for.

### Where signing secrets live (on the Air)

Every item below lives in the **Air's** login keychain or home directory. The MBP holds no signing secret at all, so an unattended job there has nothing to leak. Nothing secret goes in the repo or in `~/.tmwk` (that is tmwk's app data under the side-by-side plan).

| Secret                                       | Where                                                                                                                                                                     | How the release script reads it                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Developer ID Application certificate and key | Exported once as a `.p12`, then stored **base64** as a login-keychain generic password: service `dev.tmwk.release`, account `CSC_LINK`. Delete the `.p12` file afterwards | `CSC_LINK=$(security find-generic-password -s dev.tmwk.release -a CSC_LINK -w)` (electron-builder accepts base64) |
| `.p12` password                              | Login keychain, service `dev.tmwk.release`, account `CSC_KEY_PASSWORD`                                                                                                    | Same pattern                                                                                                      |
| Apple app-specific password                  | Login keychain, service `dev.tmwk.release`, account `APPLE_APP_SPECIFIC_PASSWORD`                                                                                         | Same pattern                                                                                                      |
| tmwk PostHog write key                       | Login keychain, service `dev.tmwk.release`, account `ORCA_POSTHOG_WRITE_KEY`                                                                                              | `build-release-js.sh` (checks its hash)                                                                           |
| Apple ID email, Team ID                      | Not secret: `~/.config/tmwk-release/env` on the Air (mode 600), holding `APPLE_ID=` and `APPLE_TEAM_ID=`                                                                  | `source`d                                                                                                         |
| GitHub token                                 | The Air's gh login                                                                                                                                                        | `GH_TOKEN=$(gh auth token)` for the publish step only                                                             |

The values go into the environment of the release process only, never into a file or a log. Turn on FileVault on the Air if it is not already **(verify)**; the login keychain is unlocked only while you are logged in. The first read prompts for keychain access. Click "Always Allow" for `/usr/bin/security`, or run the script from a GUI terminal while you are at the Mac. **The nightly job runs on the MBP and cannot read these items.** Whether a ~6 KB base64 value fits a generic password is a **(verify)**; if it does not, keep the `.p12` at `~/.config/tmwk-release/developer-id.p12` (mode 600) and point `CSC_LINK` at the path. If you would rather use 1Password, install `op` and read the items with `op read`; the script calls a single `read_secret` function, so only that function changes.

The repo's notarize path does not support an App Store Connect API key or a `notarytool` keychain profile. Adding one would be an Extend to `build-mac-notarization-overlap.mjs`. It is a later improvement, not needed for v0.

### Step by step

The script is `config/tmwk/release/release-mac.sh <version>` (Own). You run it by hand **on the Air**, from a terminal in a fresh worktree, not from inside a running tmwk. Each step stops the script on failure.

1. **Preflight.**
   - The tree is clean, and `HEAD` is `origin/main` or a release branch.
   - The commit status `tmwk/nightly` on `HEAD` is `success`. Checked with `gh api repos/tmwkdev/tmwk-app/commits/<sha>/status`. `--allow-unchecked` overrides this, and the release notes then say so. This is where "main is semi-stable" becomes "a release is green".
   - `security find-identity -v -p codesigning` shows a `Developer ID Application` identity with the expected Team ID.
2. **Version.** Set `package.json` `version` to `<version>` (`0.1.0` first). Commit it as `release: v<version>`, tag `v<version>` and push the tag. Nothing builds from an untagged commit.
3. **Fresh checkout.**
   - `git worktree add ~/tmwk-release/v<version> v<version>` on the Air.
   - `pnpm install --frozen-lockfile --cpu=current,x64,arm64`, then `(cd mobile && pnpm install --frozen-lockfile)`.
4. **Secrets into the environment.** Read the keychain items (above). Then run `node config/scripts/desktop-distribution/macos/verify-macos-release-env.mjs` and `pnpm verify:macos-entitlements`.
5. **Build JavaScript, natives and the server template.**
   - `config/tmwk/release/build-release-js.sh`. It reads tmwk's PostHog key from the keychain, checks its hash, unsets `ORCA_DIAGNOSTICS_TOKEN_URL`, sets `ORCA_BUILD_IDENTITY=stable` and runs `NODE_OPTIONS=--max-old-space-size=4096 pnpm run build:release`. The key never goes on a command line or into a log ([telemetry-plan.md](telemetry-plan.md) stage 3).
   - Linux slots: `ssh <vm> 'cd ~/tmwk-release && git fetch && git checkout v<version> && <the prebuild steps from node-server-tests.yml for linux-x64-glibc and linux-x64-musl>'`, then `rsync` its `out/orcad-prebuilds/` into the Air's `out/orcad-prebuilds/` **(verify** that the prebuild manifest merges across hosts; upstream merges per-lane artifacts in `qualified-orcad-template.yml`**)**.
   - `node config/scripts/orcad-distribution/template/build-orcad-template.mjs --targets darwin-arm64,darwin-x64,linux-x64-glibc,linux-x64-musl`, then set `ORCA_REQUIRE_ORCAD_TEMPLATE=1` plus the tmwk flag that lets packaging verify the declared subset (A7).
6. **Native runtime gates.** Run `node config/scripts/diagnostics/runtime-watchers/runtime-file-watcher-fault-harness.mjs` and its `ELECTRON_RUN_AS_NODE=1 pnpm exec electron ...` twin. Then run `pinned-node-downloads.mjs darwin-arm64 darwin-x64` and `ensure-native-runtime.mjs --runtime=electron`, as in `release-mac-build.yml`.
7. **Draft release.** `gh release create v<version> --repo tmwkdev/tmwk-app --draft --title "tmwk <version> (beta)" --notes-file <notes>`.
8. **Package, sign, notarize and upload.**
   - Command: `GH_TOKEN=$(gh auth token) ORCA_MAC_RELEASE=1 node config/scripts/desktop-distribution/macos/build-mac-notarization-overlap.mjs --publish always --draft`, with the tmwk overlay config (needs the Extend below).
   - electron-builder signs with hardened runtime and `resources/build/entitlements.mac.plist`. It notarizes each slice through `@electron/notarize` while the next one builds, staples, and uploads the dmgs, zips, blockmaps and `latest-mac.yml` to the draft.
   - Expect 20 to 40 minutes for notarization **(verify)**.
9. **Update metadata.** `node config/scripts/desktop-distribution/macos/gate-mac-update-manifests.mjs dist` writes `minimumSystemVersion` into the manifest. Then `gh release upload v<version> dist/*-mac.yml --repo tmwkdev/tmwk-app --clobber`.
10. **Guard the draft.**
    - `GITHUB_REPOSITORY=tmwkdev/tmwk-app GH_TOKEN=$(gh auth token) node config/scripts/release/publication/assert-github-release-is-draft.mjs v<version>`.
    - `node config/tmwk/release/verify-tmwk-telemetry-key.mjs dist` (the baked-in PostHog key must be tmwk's), in place of upstream's `verify-telemetry-constants.mjs` ([telemetry-plan.md](telemetry-plan.md) item 4).
11. **Verify the artifacts.** `codesign --verify --deep --strict --verbose=2 dist/mac*/tmwk.app`, `spctl -a -vv dist/mac*/tmwk.app` ("Notarized Developer ID") and `xcrun stapler validate dist/tmwk-macos-*.dmg`.
12. **Smoke test (you).** Install from the draft's dmg on a Mac that has Orca installed, and run the side-by-side guide's acceptance checks. Add one SSH host on Linux x64 to prove the template, and one on Linux arm64 to see the refusal for a missing slot.
13. **Publish (you).** `gh release edit v<version> --repo tmwkdev/tmwk-app --draft=false`.
14. **After publish.** Point the README's download link at the release, and record the version and SHA in this doc's release log. The release notes say which SSH host targets 0.1.0 supports: macOS, and Linux x64 with glibc or musl. From `0.1.1` on, confirm that `0.1.0` updates itself, as in side-by-side P5 acceptance.

Before Apple enrollment completes, the same script runs with `--unsigned`. It skips steps 4 and 8's signing and notarization, builds with `pnpm tmwk:build:mac`, and uploads a draft marked "unsigned: right-click → Open". Squirrel.Mac refuses updates for ad-hoc builds, so these are manual downloads only.

## What the homelab takes on

`pve` is idle (load 0.1) and has room for one Ubuntu 24.04 VM with 4 vCPU, 8 GiB and a 60 GiB disk, alongside the running VMs.

1. **Needed for releases (decision 6): the Linux x64 orcad prebuilds.** This means `linux-x64-glibc` natively and `linux-x64-musl` in an Alpine container, so the VM needs docker. The VM also needs Node 24, pnpm 12.14.0 and an ssh key the Air can use. Linux arm64 and Windows stay out of v0 because no local host can build them.
2. **Later: Linux CI.** Upstream's `ubuntu-*` jobs, `package` (Linux), the glibc-floor containers, and the Linux-only tests that macOS skips. It would run as a `linux` mode of the nightly, over ssh from the MBP, so you still get one report.
3. **Later: the 46-minute unit suite,** if overnight agent work slows it down on the MBP.
4. **Never:** signing, notarization or Mac packaging. Those need macOS and the Air's keychain.

## Part 1: what you do by hand

Each item lists what it unblocks. Nothing in Part 2 starts before its prerequisite is done.

| #   | Manual step                                                                                                                                                                                                                                                                                                                                                         | Unblocks         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| M1  | **Done 2026-11-20.** Say "go" to your coordinator for the nightly setup on the MBP: the `~/ci` layout, the bare mirror, the `dev.tmwk.nightly` and `dev.tmwk.nightly-deliver` LaunchAgents, and deleting the 2026-11-18 leftovers in `~/ci` (3.5 GiB). Workers must ask before each of these                                                                        | A1, A2, A3       |
| M2  | **Done 2026-11-20** (an agent created it). Create the `nightly` label on `tmwkdev/tmwk-app`, or approve the agent creating it                                                                                                                                                                                                                                       | A4               |
| M3  | Pair the MBP with the Air's Orca: make a pairing code on the Air, then run `orca environment add` on the MBP yourself, or hand the code to the coordinator. Keep a `main` Run alive on the Air (the main chat does this)                                                                                                                                            | A5               |
| M4  | Finish Apple Developer Program enrollment. Note your Team ID                                                                                                                                                                                                                                                                                                        | M5               |
| M5  | **On the Air**, check the release toolchain: `uname -m` shows `arm64`, Rosetta is installed (`softwareupdate --install-rosetta` if not), and Node 24, pnpm 12.14.0, `gh auth status` and `xcrun notarytool --version` all work. Turn on FileVault if it is off. Say "go" for an agent to install whatever is missing                                                | M6, A8           |
| M6  | **On the Air**, create the certificate: Keychain Access → Certificate Assistant → Request a Certificate from a CA, saved to disk. Upload it at developer.apple.com → Certificates → **Developer ID Application**. Download the `.cer` and double-click it, so the private key never leaves the Air. Export the identity as `.p12` with a strong password            | M8               |
| M7  | Create an app-specific password at account.apple.com → Sign-In and Security                                                                                                                                                                                                                                                                                         | M8               |
| M8  | **On the Air**, store the secrets yourself, so no agent ever sees them: `security add-generic-password -s dev.tmwk.release -a CSC_LINK -w "$(base64 -i developer-id.p12)"`, the same for `CSC_KEY_PASSWORD` and `APPLE_APP_SPECIFIC_PASSWORD`, then write `~/.config/tmwk-release/env` (mode 600). Delete the `.p12` file, and keep a copy in your password manager | A10              |
| M9  | Approve the Ubuntu VM on `pve` (decision 6 needs it), and add the Air's public key to it                                                                                                                                                                                                                                                                            | A9               |
| M10 | Optional hardening: replace the MBP's broad gh OAuth login with a fine-grained token, limited to `tmwkdev/tmwk-app` with Commit statuses write, Issues write and Metadata read                                                                                                                                                                                      | none (hardening) |

## Part 2: what an agent sets up afterwards

Each phase stands on its own. Every row names the manual step it waits on.

**Phase 1: nightly runs and logs (after M1). Done 2026-11-20, except A3's triage.**

| #   | Agent step                                                                                                                                                                                                                                                                                              | Needs |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1  | In a PR: add `config/tmwk/local-ci/nightly.sh`, `install.sh`, `dev.tmwk.nightly.plist` and a short README. Add the `config/tmwk/**` row to `fork-ownership.md`                                                                                                                                          | M1    |
| A2  | On the MBP: `git clone --mirror git@github.com:tmwkdev/tmwk-app.git ~/ci/tmwk-app.git`. Run `install.sh`, which copies to `~/ci/bin`, installs the plist into `~/Library/LaunchAgents/` and runs `launchctl bootstrap gui/$(id -u) ...`. Delete `~/ci/tmwk-app`, `~/ci/unit-run.*` and `~/ci/clean.log` | M1    |
| A3  | Kick off one run by hand (`launchctl kickstart gui/$(id -u)/dev.tmwk.nightly`). Record each step's time here. Triage the failing test files: fix environment causes, or file one issue per real failure, so that "new failures" starts from an honest baseline                                          | M1    |

**Phase 2: status and fallback issue (after M2). Done 2026-11-20.**

| #   | Agent step                                                                                                                                                                                          | Needs |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A4  | Add the `tmwk/nightly` commit status, the fallback `Nightly: main is red` issue, and `nightly-status`. Prove them with one forced red run (`NIGHTLY_FORCE_FAIL=1`, still on main) and one green run | M2    |

**Phase 3: tickets in Needs you (after M3).**

| #   | Agent step                                                                                                                                                                                                                                                                                                                                                                                | Needs  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A5  | Add ticket delivery to `nightly.sh` (create, dedupe by signature, complete on green), the outbox and `dev.tmwk.nightly-deliver`. Settle the two **(verify)** items in [How results reach you](#how-results-reach-you). Prove it with a forced red run while the Air is awake, one while it is asleep (expect the issue first, then the ticket), and a green run that completes the ticket | M3, A4 |

**Phase 4: releases.**

| #   | Agent step                                                                                                                                                                                                                                                                                                                                                                                                              | Needs         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| A6  | Land side-by-side P0 (overlay, `dev.tmwk.app`, publish to `tmwkdev/tmwk-app`). Then switch nightly step 6 to `pnpm tmwk:build:mac`                                                                                                                                                                                                                                                                                      | PR #38 merged |
| A7  | Add the release Extends, each logged in `fork-ownership.md`: a config-path option for `build-mac-notarization-overlap.mjs:124`; a team-id override for `electron-builder.config.cjs:259`; `TELEMETRY_ENABLED = false` in packaged tmwk (`src/main/telemetry/client.ts:24`); and a flag so packaging verifies the template's declared targets, not all eight. Add `config/tmwk/release/release-mac.sh` with `--unsigned` | A6            |
| A8  | On the Air, cut an unsigned `v0.1.0-unsigned` draft to prove steps 1 to 3, 5 (without Linux slots) and 9 to 11, then delete it                                                                                                                                                                                                                                                                                          | A7, M5        |
| A9  | Build the Ubuntu VM with Node 24, pnpm and docker. Add the Linux x64 prebuild step that release step 5 calls over ssh, and prove the Air can pull its output into a template                                                                                                                                                                                                                                            | M9, A7        |
| A10 | Dry-run the signed path on the Air to a throwaway draft. Verify `spctl` and `stapler`, then delete the draft. You run the real `release-mac.sh 0.1.0` and publish (steps 12 and 13)                                                                                                                                                                                                                                     | M8, A8, A9    |

## Future work

- **Telemetry for tmwk** (decision 8): staged in [telemetry-plan.md](telemetry-plan.md). Until its later stages, packaged tmwk sends none.
- **SSH targets beyond Linux x64:** the `linux-arm64-*` and `win32-*` slots need hosts we do not have locally.
- **Notarization with an App Store Connect API key** instead of an Apple ID and app-specific password (an Extend to `build-mac-notarization-overlap.mjs`).

No open questions remain from the first draft. The decisions are recorded above.
