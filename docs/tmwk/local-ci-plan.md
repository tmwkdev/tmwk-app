# Local CI and releases: nightly checks and Mac releases on our own machines

Status: plan, not yet built. It **replaces** the earlier version of this file (the 2026-11-18 "run checks on the always-on MacBook Pro" proposal). That plan's measurements are kept below. Its per-PR gate and PR poller are dropped, because the owner has since decided against gating merges.

Machine facts were observed on the MBP and over `ssh pve` on 2026-11-20. Repo facts come from reading `origin/main` at `556813aa33`. Nothing was installed, scheduled, stored or run on either machine for this plan. Items marked **(verify)** were read but not run.

The point is the same as the product's: keep Orca's machinery, and make it simple to live with. One job runs at night, one issue tells you when main is broken, and one script cuts a release.

## Decisions already made (owner)

1. GitHub Actions stays off on `tmwkdev/tmwk-app`, to save cost. The API agrees: `actions/permissions` returns `enabled: false`.
2. **Merges are not gated on CI.** Main only has to stay semi-stable until real releases are cut from it.
3. A **nightly job** runs once a night against the latest `main`, at about 00:30 America/Chicago.
4. Releases run locally, never in Actions. That covers building, Developer ID signing, notarization (once Apple enrollment completes) and publishing to `tmwkdev/tmwk-app` GitHub Releases. v0 is a **macOS-only beta**: version `0.1.0`, bundle id `dev.tmwk.app`. Windows and Linux are not tested for v0.

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
- **The orcad template.** Release packaging sets `ORCA_REQUIRE_ORCAD_TEMPLATE=1` (`packaged-orcad-template.cjs:42-61`). Upstream builds that template from native prebuilds made on six runner types (`node-server-tests.yml:155`: Ubuntu x64 and arm64, macOS arm64 and Intel, Windows x64 and arm64). It lets the desktop app deploy its server to SSH hosts. A local release can build only part of it (see [release decision 2](#release-decisions-for-the-owner)).
- **Upstream release workflows** (`release-cut.yml`, `release-mac-build.yml` and the others) stay untouched (Track). With Actions off they never run here.

## Measured on the MBP (2026-11-18, kept from the earlier plan)

`pnpm test --maxWorkers=2` under `nice -n 10`, at main `887f5c3`:

- Clone: 78 s. Install (`pnpm install --frozen-lockfile`): 54 s.
- Tests: **2,782 s (46.4 min)**. 3,793 files passed, **17 failed**, 109 skipped; 16,223 tests passed, 15 failed, 435 skipped.
- The failing files include `native-process-spawn`, `release-checkout`, `process-host-dev-rebuild`, `macos-terminal-host-bundle`, `packaged-cli-assets`, `reclaim-worktree-generated-files`, `pr-auxiliary-preflight-admission` and `dependency-security-release`. bun and gh were missing then, and the mobile install was not done, so re-run before triaging.
- Not yet timed: `pnpm tc`, `pnpm lint`, `pnpm check:changed`, `pnpm build:mac`.

## The nightly job

### What it runs

It runs against the head of `origin/main` at start time, in this order. Each step writes its own log, and a failed step does not stop the later ones, so one report covers the whole night.

| #   | Step            | Command                                                                                                                             | Why                                                                                                                                           |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Skip check      | If `origin/main` equals `last-run-sha`, exit without reporting                                                                      | No new commits means no new information                                                                                                       |
| 1   | Install         | `pnpm install --frozen-lockfile` then `(cd mobile && pnpm install --frozen-lockfile)`                                               | Fresh deps against the shared pnpm store                                                                                                      |
| 2   | Day's diff gate | `pnpm check:changed --base=<last-green-sha> --maxWorkers=2`                                                                         | The same gate agents run before a push, applied to everything that landed since the last green night. On the first night, use `--base=HEAD~1` |
| 3   | Typecheck       | `pnpm tc`                                                                                                                           | Whole-repo types; the gate in step 2 is only path-selected                                                                                    |
| 4   | Lint            | `pnpm lint`                                                                                                                         | The full lint gate                                                                                                                            |
| 5   | Unit suite      | `pnpm test --maxWorkers=2` with JSON output to the run directory **(verify** the reporter flag `run-vitest.mjs` passes through**)** | About 46 min. Reported as **new failures since last night**, so a known-bad file is not news every morning                                    |
| 6   | Package         | `ORCA_BACKGROUND_LAUNCH=1 pnpm build:mac` with `CI` unset                                                                           | Proves main still packages. Ad-hoc signed; never launched. Switches to `pnpm tmwk:build:mac` once side-by-side P0 lands                       |

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
    lock/                  created with mkdir; present while a run is active
  bin/nightly              launchd entry point (copied from the repo, see below)
  bin/nightly-status       prints the latest summary
```

The scripts live in the repo, as Own code, at `config/tmwk/local-ci/nightly.sh` and `config/tmwk/local-ci/dev.tmwk.nightly.plist`. The PR that adds them also adds a `config/tmwk/**` row to [fork-ownership.md](fork-ownership.md). The side-by-side guide's overlay needs the same row. `~/ci/bin/nightly` is a copy, refreshed by `install.sh`, so a bad commit on main cannot rewrite the runner that reports on it.

The job is a **LaunchAgent**, not a LaunchDaemon. It runs as `ty`, has access to the gh token and the ssh key, and needs no sudo.

```xml
<key>Label</key><string>dev.tmwk.nightly</string>
<key>ProgramArguments</key>
<array><string>/bin/zsh</string><string>/Users/ty/ci/bin/nightly</string></array>
<key>StartCalendarInterval</key>
<dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>30</integer></dict>
<key>ProcessType</key><string>Background</string>
<key>LowPriorityIO</key><true/>
<key>Nice</key><integer>15</integer>
<key>StandardOutPath</key><string>/Users/ty/ci/nightly/launchd.log</string>
<key>StandardErrorPath</key><string>/Users/ty/ci/nightly/launchd.log</string>
```

launchd's calendar times are local time, so 00:30 is Chicago time, DST included. If the Mac ever sleeps through 00:30, launchd runs the job once on wake. `/bin/zsh` sources `~/.zshenv`, which loads nvm, so no Node path is pinned in the plist.

### Keeping it out of the way

- **One run at a time.** `mkdir ~/ci/nightly/lock` must succeed or the job exits. A lock older than 6 hours is treated as stale and reported.
- **Low priority.** The job runs with `Nice 15`, `ProcessType Background` and `LowPriorityIO` in the plist, and `taskpolicy -b` around the heavy steps. vitest and `check:changed` are capped at `--maxWorkers=2`. Agents keep running overnight (load was 23 mid-morning), so this matters at 00:30 too.
- **Own checkout.** The job never runs in `~/tmwk-ssh-target/tmwk-app` or any Orca worktree. It never pushes and never writes to any branch.
- **No windows.** `ORCA_BACKGROUND_LAUNCH=1` is set for every step. No e2e runs, and nothing calls `open`.
- **Bounded disk.** The job prunes run directories older than 14 days. `git clean -fdx -e node_modules` runs between nights, and the pnpm store is pruned weekly (`pnpm store prune`).
- **Timeout.** Each step gets a hard limit (step 5 gets 90 min), so a hang cannot hold the lock into the morning.
- **Main only.** The repo is public. The job only checks out `origin/main`, never a PR head, because it runs repo code with `ty`'s permissions, the gh token and the ssh key.

### How results reach you

Phase 2 sends results through three channels.

1. **A commit status on the night's SHA:** `gh api -X POST repos/tmwkdev/tmwk-app/statuses/<sha> -f context=tmwk/nightly -f state=success|failure -f description="<n> new test failures; tc ok; lint failed"`. It shows as a check mark or cross on the commit and the main branch page. The commit statuses API works with Actions off. The release script reads this status (see the [release flow](#the-release-flow-macos-beta)).
2. **One rolling GitHub issue, `Nightly: main is red`,** with a new `nightly` label. A red night opens the issue, or comments on it if it is already open. A green night comments and closes it. GitHub's notifications then reach your phone and email. The comment lists:
   - each failing step
   - test files that are newly failing and newly fixed
   - the SHA range `last-green..sha`
   - the log path on the MBP

   The repo is public, so the comment carries step names and file names only, never raw log text, environment or paths outside the repo.

3. **A morning line in the tmwk main chat (phase 3).** This needs the MBP to reach the Air's Orca. Pair it once with `orca environment add` (a pairing code from the Air, a manual step). Then send with `orca orchestration send --environment <air> ...` or, once M3/M4 tickets exist, open a tmwk ticket for a red night. **(Verify)** which handle addresses the main session; this waits on the M3/M4 ticket work.

On the MBP, `~/ci/bin/nightly-status` prints the latest `summary.json`, and `orca` agents can read it over `ssh mbp`.

## The release flow (macOS beta)

### Release decisions for the owner

1. **Where the arm64 slice is built.** The MBP is Intel, and release packaging refuses to ship an arm64 slice it cannot boot (see [In the repo](#in-the-repo-read-on-originmain)). Options:
   - **(a) Recommended:** run the release script on an Apple Silicon Mac. It builds and boot-checks both slices, with x64 through Rosetta. That could be the MacBook Air **(verify** its chip; not observed from here**)**.
   - **(b)** Ship `0.1.0` as **x64 only** from the MBP. It runs on Apple Silicon under Rosetta, which is slower and prompts for Rosetta at first launch.
   - **(c)** Patch the check to skip cross-arch boots (Extend). This drops the check that the slice can serve a PTY before it ships. Not recommended.

   The nightly stays on the MBP whichever you choose.

2. **The SSH-host server template.** A fully local release cannot build the Windows and Linux arm64 prebuilds. Options:
   - **(a)** Ship v0 without the template: the release script leaves `ORCA_REQUIRE_ORCAD_TEMPLATE` unset. **(Verify)** what remote-host setup does then; `orcad-artifact-materializer.ts` is where to look.
   - **(b)** Build the macOS and Linux x64 slots locally, using a homelab VM for Linux. **(Verify)** that `build-orcad-template.mjs --targets ...` accepts a partial target set for a release.

   Remote hosts are a first-class citizen, so (a) needs an explicit "SSH hosts not supported in 0.1.0" in the release notes.

3. **Beta as a prerelease or not.** `https://github.com/tmwkdev/tmwk-app/releases/latest` skips prereleases. The side-by-side guide's done-when links there. Recommended: publish `v0.1.0` as a normal release titled "tmwk 0.1.0 (beta)". **(Verify)** how the updater's channel code (`release-channel.ts`) treats a prerelease before choosing otherwise.
4. **Telemetry.** Upstream injects `ORCA_POSTHOG_WRITE_KEY` and `ORCA_DIAGNOSTICS_TOKEN_URL=https://orca.dev/...` at build time, and `verify-telemetry-constants.mjs` checks them. tmwk must set its own values or build with telemetry off. It must never send to Orca's.

### Where signing secrets live on the MBP

Nothing secret goes in the repo, in `~/ci`, or in `~/.tmwk` (that is tmwk's app data under the side-by-side plan).

| Secret                                       | Where                                                                                                                                                                     | How the release script reads it                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Developer ID Application certificate and key | Exported once as a `.p12`, then stored **base64** as a login-keychain generic password: service `dev.tmwk.release`, account `CSC_LINK`. Delete the `.p12` file afterwards | `CSC_LINK=$(security find-generic-password -s dev.tmwk.release -a CSC_LINK -w)` (electron-builder accepts base64) |
| `.p12` password                              | Login keychain, service `dev.tmwk.release`, account `CSC_KEY_PASSWORD`                                                                                                    | Same pattern                                                                                                      |
| Apple app-specific password                  | Login keychain, service `dev.tmwk.release`, account `APPLE_APP_SPECIFIC_PASSWORD`                                                                                         | Same pattern                                                                                                      |
| Apple ID email, Team ID                      | Not secret: `~/.config/tmwk-release/env` (mode 600), holding `APPLE_ID=` and `APPLE_TEAM_ID=`                                                                             | `source`d                                                                                                         |
| GitHub token                                 | The existing gh login                                                                                                                                                     | `GH_TOKEN=$(gh auth token)` for the publish step only                                                             |

The values go into the environment of the release process only, never into a file or a log. FileVault is on, and the login keychain is unlocked only while `ty` is logged in. The first read prompts for keychain access. Click "Always Allow" for `/usr/bin/security`, or run the script from a GUI terminal while you are at the Mac. **The nightly job never reads these items.** Whether a ~6 KB base64 value fits a generic password is a **(verify)**; if it does not, keep the `.p12` at `~/.config/tmwk-release/developer-id.p12` (mode 600) and point `CSC_LINK` at the path. If you would rather use 1Password, install `op` and read the items with `op read`; the script calls a single `read_secret` function, so only that function changes.

The repo's notarize path does not support an App Store Connect API key or a `notarytool` keychain profile. Adding one would be an Extend to `build-mac-notarization-overlap.mjs`. It is a later improvement, not needed for v0.

### Step by step

The script is `config/tmwk/release/release-mac.sh <version>` (Own), which you run by hand. Each step stops the script on failure.

1. **Preflight.**
   - The tree is clean, and `HEAD` is `origin/main` or a release branch.
   - The commit status `tmwk/nightly` on `HEAD` is `success`. Checked with `gh api repos/tmwkdev/tmwk-app/commits/<sha>/status`. `--allow-unchecked` overrides this, and the release notes then say so. This is where "main is semi-stable" becomes "a release is green".
   - `security find-identity -v -p codesigning` shows a `Developer ID Application` identity with the expected Team ID.
2. **Version.** Set `package.json` `version` to `<version>` (`0.1.0` first). Commit it as `release: v<version>`, tag `v<version>` and push the tag. Nothing builds from an untagged commit.
3. **Fresh checkout.**
   - `git worktree add ~/ci/work/release-v<version> v<version>`.
   - `pnpm install --frozen-lockfile --cpu=current,x64,arm64`, then `(cd mobile && pnpm install --frozen-lockfile)`.
4. **Secrets into the environment.** Read the keychain items (above). Then run `node config/scripts/desktop-distribution/macos/verify-macos-release-env.mjs` and `pnpm verify:macos-entitlements`.
5. **Build JavaScript and natives.** `ORCA_BUILD_IDENTITY=stable NODE_OPTIONS=--max-old-space-size=4096 pnpm run build:release`, plus the telemetry values from decision 4. If decision 2 is (b), run `pnpm build:orcad-template ...` and set `ORCA_REQUIRE_ORCAD_TEMPLATE=1`.
6. **Native runtime gates.** Run `node config/scripts/diagnostics/runtime-watchers/runtime-file-watcher-fault-harness.mjs` and its `ELECTRON_RUN_AS_NODE=1 pnpm exec electron ...` twin. Then run `pinned-node-downloads.mjs darwin-arm64 darwin-x64` and `ensure-native-runtime.mjs --runtime=electron`, as in `release-mac-build.yml`.
7. **Draft release.** `gh release create v<version> --repo tmwkdev/tmwk-app --draft --title "tmwk <version> (beta)" --notes-file <notes>`.
8. **Package, sign, notarize and upload.**
   - Command: `GH_TOKEN=$(gh auth token) ORCA_MAC_RELEASE=1 node config/scripts/desktop-distribution/macos/build-mac-notarization-overlap.mjs --publish always --draft`, with the tmwk overlay config (needs the Extend below).
   - electron-builder signs with hardened runtime and `resources/build/entitlements.mac.plist`. It notarizes each slice through `@electron/notarize` while the next one builds, staples, and uploads the dmgs, zips, blockmaps and `latest-mac.yml` to the draft.
   - Expect 20 to 40 minutes for notarization **(verify)**.
9. **Update metadata.** `node config/scripts/desktop-distribution/macos/gate-mac-update-manifests.mjs dist` writes `minimumSystemVersion` into the manifest. Then `gh release upload v<version> dist/*-mac.yml --repo tmwkdev/tmwk-app --clobber`.
10. **Guard the draft.**
    - `GITHUB_REPOSITORY=tmwkdev/tmwk-app GH_TOKEN=$(gh auth token) node config/scripts/release/publication/assert-github-release-is-draft.mjs v<version>`.
    - `node config/scripts/desktop-build/telemetry-contracts/verify-telemetry-constants.mjs`.
11. **Verify the artifacts.** `codesign --verify --deep --strict --verbose=2 dist/mac*/tmwk.app`, `spctl -a -vv dist/mac*/tmwk.app` ("Notarized Developer ID") and `xcrun stapler validate dist/tmwk-macos-*.dmg`.
12. **Smoke test (you).** Install from the draft's dmg on a Mac that has Orca installed, and run the side-by-side guide's acceptance checks.
13. **Publish (you).** `gh release edit v<version> --repo tmwkdev/tmwk-app --draft=false`.
14. **After publish.** Point the README's download link at the release, and record the version and SHA in this doc's release log. From `0.1.1` on, confirm that `0.1.0` updates itself, as in side-by-side P5 acceptance.

Before Apple enrollment completes, the same script runs with `--unsigned`. It skips steps 4 and 8's signing and notarization, builds with `pnpm tmwk:build:mac`, and uploads a draft marked "unsigned: right-click → Open". Squirrel.Mac refuses updates for ad-hoc builds, so these are manual downloads only.

## What the homelab could take on

`pve` is idle (load 0.1) and has room for one Ubuntu 24.04 VM with 4 vCPU, 8 GiB and a 60 GiB disk, alongside the running VMs. None of this is needed for v0. In order of value:

1. **Linux CI, when Linux matters.** Upstream's `ubuntu-*` jobs, `package` (Linux), the glibc-floor and musl containers (needs docker in the VM), and the Linux-only tests that macOS skips.
2. **Linux x64 orcad prebuilds** for release decision 2(b). `build-orcad-template.mjs --targets linux-x64-glibc` runs on a Linux x64 host. Linux arm64 and Windows still have no local host.
3. **Moving the 46-minute unit suite off the MBP** if overnight agent work slows it down. The MBP then keeps only the Mac-specific steps (5 partly, and 6).
4. **Not:** signing, notarization or Mac packaging. Those need macOS and the keychain.

## Part 1: what you do by hand

Each item lists what it unblocks. Nothing in Part 2 starts before its prerequisite is done.

| #   | Manual step                                                                                                                                                                                                                                                                                                                                                                   | Unblocks         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| M1  | Say "go" to your coordinator for the nightly setup: `~/ci` layout, the bare mirror, the `dev.tmwk.nightly` LaunchAgent, and deleting the 2026-11-18 leftovers in `~/ci` (3.5 GiB). Workers must ask before each of these                                                                                                                                                      | A1, A2, A3       |
| M2  | Create the `nightly` label on `tmwkdev/tmwk-app`, or approve the agent creating it                                                                                                                                                                                                                                                                                            | A4               |
| M3  | Choose release decisions 1 to 4 above                                                                                                                                                                                                                                                                                                                                         | A6, A7           |
| M4  | Finish Apple Developer Program enrollment. Note your Team ID                                                                                                                                                                                                                                                                                                                  | M5               |
| M5  | On the Mac that will sign (the MBP or the Apple Silicon Mac from decision 1), create the certificate: Keychain Access → Certificate Assistant → Request a Certificate from a CA, saved to disk. Upload it at developer.apple.com → Certificates → **Developer ID Application**. Download the `.cer` and double-click it. Export the identity as `.p12` with a strong password | M6               |
| M6  | Create an app-specific password at account.apple.com → Sign-In and Security                                                                                                                                                                                                                                                                                                   | M7               |
| M7  | Store the secrets yourself, so no agent ever sees them: `security add-generic-password -s dev.tmwk.release -a CSC_LINK -w "$(base64 -i developer-id.p12)"`, the same for `CSC_KEY_PASSWORD` and `APPLE_APP_SPECIFIC_PASSWORD`, then write `~/.config/tmwk-release/env`. Delete the `.p12` file                                                                                | A8               |
| M8  | Optional, before phase 3: on the Air, make a pairing code for the MBP. Run `orca environment add` on the MBP yourself, or hand the code to the coordinator                                                                                                                                                                                                                    | A5               |
| M9  | Optional hardening: replace the broad gh OAuth login for the nightly with a fine-grained token, limited to `tmwkdev/tmwk-app` with Commit statuses write, Issues write and Metadata read                                                                                                                                                                                      | none (hardening) |
| M10 | Optional, for homelab item 1 or 2: approve a new Ubuntu VM on `pve`                                                                                                                                                                                                                                                                                                           | A9               |

## Part 2: what an agent sets up afterwards

Each phase stands on its own. Every row names the manual step it waits on.

**Phase 1: nightly runs and logs (after M1).**

| #   | Agent step                                                                                                                                                                                                                                                                                              | Needs |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1  | In a PR: add `config/tmwk/local-ci/nightly.sh`, `install.sh`, `dev.tmwk.nightly.plist` and a short README. Add the `config/tmwk/**` row to `fork-ownership.md`                                                                                                                                          | M1    |
| A2  | On the MBP: `git clone --mirror git@github.com:tmwkdev/tmwk-app.git ~/ci/tmwk-app.git`. Run `install.sh`, which copies to `~/ci/bin`, installs the plist into `~/Library/LaunchAgents/` and runs `launchctl bootstrap gui/$(id -u) ...`. Delete `~/ci/tmwk-app`, `~/ci/unit-run.*` and `~/ci/clean.log` | M1    |
| A3  | Kick off one run by hand (`launchctl kickstart gui/$(id -u)/dev.tmwk.nightly`). Record each step's time here. Triage the failing test files: fix environment causes, or file one issue per real failure, so that "new failures" starts from an honest baseline                                          | M1    |

**Phase 2: reporting (after M2).**

| #   | Agent step                                                                                                                                                                                         | Needs |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A4  | Add the `tmwk/nightly` commit status, the rolling `Nightly: main is red` issue, and `nightly-status`. Prove them with one forced red run (`NIGHTLY_FORCE_FAIL=1`, still on main) and one green run | M2    |

**Phase 3: main chat (after M8 and the M3/M4 ticket work).**

| #   | Agent step                                                                                                                              | Needs             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A5  | On a red night, also send the summary to the main session (or open a tmwk ticket) through `orca orchestration send --environment <air>` | M8, M3/M4 tickets |

**Phase 4: releases.**

| #   | Agent step                                                                                                                                                                                                                                                                                                                        | Needs         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| A6  | Land side-by-side P0 (overlay, `dev.tmwk.app`, publish to `tmwkdev/tmwk-app`). Then switch nightly step 6 to `pnpm tmwk:build:mac`                                                                                                                                                                                                | PR #38 merged |
| A7  | Add release Extends: a config-path option for `build-mac-notarization-overlap.mjs:124`, a team-id override for `electron-builder.config.cjs:259`, and the telemetry values from decision 4. Add `config/tmwk/release/release-mac.sh` with `--unsigned`. Cut an unsigned `v0.1.0-unsigned` draft to prove steps 1 to 3 and 9 to 11 | M3, A6        |
| A8  | Dry-run the signed path to a throwaway draft. Verify `spctl` and `stapler`, then delete the draft. The owner runs the real `release-mac.sh 0.1.0` and publishes (steps 12 and 13)                                                                                                                                                 | M7            |

**Phase 5: homelab (optional).**

| #   | Agent step                                                                                                                                                                                                          | Needs |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A9  | Build the Ubuntu VM with Node 24, pnpm and docker. Add a `linux` mode to `nightly.sh`, run over `ssh` from the MBP's nightly so there is still one report. Optionally add the Linux x64 orcad prebuild for releases | M10   |

## Open questions

1. Release decisions 1 to 4 (above).
2. Should a red night open the issue on any failing step, or only on new unit failures? The recommendation is any step: tc, lint and packaging have no known-bad baseline.
3. Should step 6 (packaging) run every night or only on Sundays? It is the slowest step after tests (not timed yet).
