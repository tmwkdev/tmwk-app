# Side-by-side install guide: an installable tmwk next to Orca

This guide turns the brand plan's [Side by side with Orca](brand-plan.md#side-by-side-with-orca) table and its proposed steps P0–P5 into build steps. The goal is an installable `tmwk.app` that lives beside an installed `Orca.app` on one machine. **The two apps share nothing**: no files, folders, Keychain items, commands, URL schemes, update feeds, agent-hook entries or environment variables, and neither one's code knows the other exists (owner, 2026-11-20). The one exception is that Orca plugins work in tmwk, each app with its own installed copies (S18). The user gets the power of Orca and the simplicity of one download. Installing tmwk is one download and one drag, it never touches the Orca they already have, and it never needs explaining.

Written on 2026-11-19 from a read of `origin/main` at `8436bbf2af` (brand B0–B2 and D55 merged), revised on 2026-11-20 after the owner chose full separation, and revised again the same day with the owner's answers to the open questions (see [Owner decisions](#owner-decisions)). Six read-only research passes mapped the updater, the builder config and app identity, userData and `~/.orca` paths, agent hooks, CLI install and the URL scheme. This guide was written from their findings, and the claims the plan leans on were re-read by hand. No gate was run, nothing was built and nothing was launched. Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked before anything relies on them. Line numbers drift: search for the named symbol if a line has moved.

**Done when:**

- A signed, notarized `tmwk.app` 0.1.0 (a macOS-only beta, S21) downloaded from `https://github.com/tmwkdev/tmwk-app/releases/latest` installs and runs while `Orca.app` is installed and running.
- Nothing tmwk reads or writes is read or written by Orca, and the reverse. That covers files, folders, Keychain items, the global command, the URL scheme, the update feed, agent-hook entries and environment variables. Remote-host data is out of v0's scope but must stay possible to separate (S15).
- An agent started in either app reports to that app only, exactly once.
- Uninstalling either app leaves the other untouched.
- tmwk updates itself from `tmwkdev/tmwk-app` and never from `stablyai/orca`. Releases are built, signed, notarized and published from the MacBook Air, with GitHub Actions off (S20).
- Source and dev runs (`pnpm dev`, `orca-dev`) behave exactly as they do today.

"Untouched" has a testable meaning. Hash these before tmwk is installed: Orca's userData, all of `~/.orca`, Orca's Keychain item, `/usr/local/bin/orca`, and Orca's own entries in each agent's settings file. After the [validation runbook](#validation-runbook), they hash the same, apart from files Orca itself wrote while it ran. In a tmwk terminal, `env | grep '^ORCA_'` prints nothing.

## What the research changed

The brand plan's table was a first outline. The code says six things it did not:

1. **Agent hooks are built to be shared between Orca builds.** "Parallel Orca instances must share one user-wide script path" (`src/main/agent-hooks/installation/scripts/managed-hook-script-path.ts:4`). The installer decides which settings entries are its own by searching each command for `agent-hooks/<name>.{sh,cmd,ps1}`, whatever the folder (`managed-hook-command-matching.ts:9-32`). Every installed hook script reacts to `ORCA_*` variables in the agent's environment (`claude/hooks/hook-script.ts:76-122`). Moving the scripts to `~/.tmwk/agent-hooks` alone would make the apps delete each other's entries, or deliver every event twice. Full separation needs three changes together: a path the matcher can't see, its own environment names, and its own markers (S7, S8, S17).
2. **userData probably moves with one overlay field.** Packaged userData comes from Electron's default, `appData/<package.json name>` (`package.json:2` is `"name": "orca"`). The overlay can set `extraMetadata.name: 'tmwk'`. That should move the folder, the single-instance lock, the plugin folders and the updater cache with no source edit (**verify**, P1). About 12 places outside Electron that rebuild the folder path still need edits.
3. **The global CLI install would overwrite Orca's `orca`.** On macOS, any symlink into some `*.app/Contents/Resources/bin/<same basename>` counts as "an older copy of ours" and gets replaced (`src/main/cli/installation/cli-command-inspection.ts:132-136`). With the launcher still named `orca`, tmwk's install would take over `/usr/local/bin/orca`.
4. **The macOS CLI launcher hard-codes the executable name**: `ELECTRON="$CONTENTS/MacOS/Orca"` (`resources/darwin/bin/orca:22`). A `productName` of `tmwk` breaks the in-terminal `orca` command in P0 unless that line changes.
5. **`~/.orca` is built in about 64 files, not 30.** About 23 are desktop-host paths. About 25 are paths on remote hosts. Those are deferred, but full separation will need them one day (S15, [Later: P3c](#later-p3c-remote-hosts-and-wsl)). The rest are hook paths and command strings (P3b).
6. **The release-repo constant also feeds two live data downloads.** `MAIN_RELEASE_REPO` is used by the stable and RC update feeds, and also by `wsl-hosts-policy-live-update.ts:33` and `agent-state-rules-live-update.ts:43`. Those two download upstream's policy and rules files. Pointing the constant at `tmwkdev/tmwk-app` would break them, so the app's update repo needs its own constant (S11).

## Preconditions

Before P0, confirm each of these still reads as written.

| Interface                             | File                                                                                                       | What this guide does with it                                            | Re-check                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder config, a plain object export | `config/electron-builder.config.cjs:262`                                                                   | The overlay `require()`s it and overrides fields                        | Still `module.exports = {…}`, not a function. Env-dependent values are computed at load (`:104-133`), so the overlay sets env first               |
| `TMWK_PRODUCT_NAME` and its JSON twin | `src/shared/tmwk/branding/tmwk-product-name.ts`, `tmwk-product-name.json`                                  | The pattern for one shared identity file that `.cjs` can read           | The JSON is `{ "productName": "tmwk" }` and the dev bundle script reads it (`dev-electron-bundle-identity.mjs:9`)                                 |
| Packaged `appName` is `tmwk` (D55)    | `src/main/startup/profile-startup/dev-instance-identity.ts:59-71`                                          | Unchanged. P1 makes userData agree with it                              | The packaged branch sets `appName: TMWK_PRODUCT_NAME`. `app.setName` runs post-ready for packaged builds (`main-process-ready-foundation.ts:115`) |
| Early userData capture                | `src/main/persistence/loading-store/user-data-path.ts:11-15`, `getCanonicalUserDataPath`                   | P1 checks that early and late userData agree                            | `initDataPath()` still runs in preflight before `app.setName`                                                                                     |
| `configureOrcaUserDataPathEnv`        | `src/main/startup/configure-process.ts:245-259`                                                            | P3 sets the home-folder env next to it                                  | It still sets `ORCA_USER_DATA_PATH` for children                                                                                                  |
| tmwk root                             | `src/main/tmwk/main-home/main-home-paths.ts:13-24`                                                         | Packaged root is already `~/.tmwk`. P3 puts Orca's home files beside it | `TMWK_HOME`, otherwise unpackaged gives `userData/tmwk` and packaged gives `~/.tmwk`                                                              |
| Hook script path and matcher          | `managed-hook-script-path.ts:4-6`, `managed-hook-command-matching.ts:9-32`                                 | P3b gives tmwk its own                                                  | One function builds every script path. The matcher still searches for `agent-hooks/<stem>`                                                        |
| Hook env in PTYs                      | `src/main/agent-hooks/server/server-runtime-env.ts:13-29`, `src/main/ipc/pty/host-env/assembly.ts:130-134` | P3b's boundary renames what leaves the app                              | The hook server still builds the env, and PTY assembly still adds it                                                                              |
| Child PATH shim                       | `src/main/cli/launchers/orca-cli-child-path.ts:19-80`                                                      | Keeps `orca` working inside tmwk's terminals (P2)                       | Four branches: headless, dev, packaged Linux, packaged mac/Windows                                                                                |
| Updater feed                          | `updater-setup.ts:172-175`, `updater-prerelease-feed.ts:15,20,72,78`, `updater-release-readiness.ts:4,110` | P5 points them at tmwk's repo                                           | Still the `generic` provider with URLs the app builds itself                                                                                      |

Read [`docs/agents-md-refs/cross-platform-support.md`](../agents-md-refs/cross-platform-support.md) before P1. Every step touches platform paths.

## Decisions

These are numbered S1–S22 so they don't collide with D-numbers that tickets running at the same time are taking. They take the next free D-numbers when the guide is accepted and logged in [fork-ownership.md](fork-ownership.md#decision-log). **Owner call** marks a recommendation that changes a documented surface or needs the owner to act.

| #   | Decision                                          | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Which builds get the tmwk identity.               | **Packaged builds only.** This repository never ships a packaged build with Orca's identity, so "packaged" means "tmwk". Source and dev runs keep `orca-dev` userData, `~/.orca`, `orca-dev`, `orca://` and `ORCA_*` env as they are. Code inside Electron checks `isPackaged()`, as `main-home-paths.ts:19` already does. Code outside Electron (the CLI, `orcad`, the daemon, hook scripts) learns it from S17's boundary and from S2's packaged defaults.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S2  | One identity file.                                | Own `src/shared/tmwk/app-identity/tmwk-app-identity.json` with a typed `tmwk-app-identity.ts` beside it, after the `tmwk-product-name` pattern: `appId: "dev.tmwk.app"` (confirmed: the owner owns `tmwk.dev`), `userDataDirName: "tmwk"`, `homeDirName: ".tmwk"`, `remoteInstallDirName: ".tmwk-remote"`, `hooksDirName: "hooks"`, `cliName: "tmwk"`, `urlScheme: "tmwk"`, `envPrefix: "TMWK_"`, `labelPrefix: "dev.tmwk.app"`, `releaseRepo: "tmwkdev/tmwk-app"`, `updaterCacheDirName: "tmwk-updater"`. The builder overlay (`.cjs`) and the TypeScript both read it. Every Extend edit below reads a value from here. None of them repeats a literal.                                                                                                                                                                                                                                                                                                                                                                                                               |
| S3  | The builder overlay.                              | Own `config/tmwk/electron-builder.tmwk.cjs`. It sets env flags, `require()`s upstream's config, and returns a copy with tmwk fields: `appId`, `productName: 'tmwk'`, `extraMetadata.name: 'tmwk'` (merged with upstream's conditional `extraMetadata`, `:267-271`), `protocols`, `win.executableName`, `linux.executableName`, `StartupWMClass`, every `artifactName`, deb/rpm `packageName`, `linux.maintainer`, the usage strings and `publish`. It must not set `win.signtoolOptions.publisherName` (S13). Upstream's file stays as it is, except the one Extend in S12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| S4  | userData.                                         | `…/tmwk` on every platform, from `extraMetadata.name` (**verify** in P1 that packaged `app.getPath('userData')` returns it). Code outside Electron that rebuilds the packaged path reads `userDataDirName`: `src/cli/runtime/profile/metadata.ts:57-71`, `src/main/codex/configuration/homes/codex-home-paths.ts:74-86`, `serve-bundle-coordination.ts:48-50`, `src/main/observability/logs-directory.ts:7-19` (today it says `Orca` with a capital O), and the Command Code hook script's scan list (`command-code-managed-script.ts:26-30,117-124`), which in tmwk scans tmwk's paths only. Labels move to `labelPrefix`: the serve launchd label `com.stablyai.orca.serve` (`serve-bundle-coordination.ts:6`) and the terminal daemon's `com.stablyai.orca.terminal.<hash>` (`macos-daemon-job-label.ts:11`). The daemon's label is already keyed by userData, but no name is shared.                                                                                                                                                                                |
| S5  | The home folder (`~/.orca` → `~/.tmwk`).          | One home-folder function, Own `src/shared/tmwk/app-identity/app-home-dir.ts`: `appHomeDir(env = process.env)` returns `env.TMWK_APP_HOME_DIR` when it is absolute, otherwise `join(homedir(), '.orca')`. Packaged main sets `TMWK_APP_HOME_DIR` to `~/.tmwk` in preflight, next to `configureOrcaUserDataPathEnv` (one Extend line), so tmwk's own children inherit it. Each `join(homedir(), '.orca')` on the desktop host becomes `appHomeDir()`, one Extend line each. Offer the function upstream as `orcaHomeDir()`. If upstream takes it, the Extend lines disappear at the next sync.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S6  | Orca's home files and tmwk's store in one folder. | Accept it. Packaged `~/.tmwk` already holds `main/`, `store/` and `main-session.json` (`main-home-paths.ts`). Orca's files (`keybindings.json`, `linear-*`, `*.enc`, `jira-*`, the hook scripts in `hooks/`, and so on) use other names, so nothing collides. P3 lists both sets in one table, so a later name clash is caught in review. One folder is the simpler mental model: everything tmwk keeps in the home folder is in `~/.tmwk`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| S7  | Agent hooks.                                      | **Fully separate (owner, 2026-11-20).** tmwk's hook scripts live in `~/.tmwk/hooks/<agent>-hook.{sh,cmd,ps1}`. The path contains no `agent-hooks/`, so Orca's matcher never sees tmwk's entries, and tmwk's matcher searches for `hooks/` under tmwk's home only. tmwk also gets its own Windows native hook executable name (`tmwk-agent-hook.exe`), its own Codex command-form marker (`tmwk-agent-hook-form=1` in place of `orca-agent-hook-form=`, `codex-hook-command-form.ts:21-32`), its own OpenCode plugin file name (in place of `orca-opencode-status.js`), its own pi extension marker (in place of `@orca-managed-pi-extension`) and its own install lock under `~/.tmwk`. Each agent's settings file then holds one Orca entry and one tmwk entry, and each app only ever adds, updates or removes its own. Through S17, each app's script does nothing in the other app's terminals. **Decided (owner, 2026-11-20):** "agent hooks … in a .tmwk dir, not an Orca. I want these two apps to run together and have no impact on each other." Built in P3b. |
| S8  | Cleanup and uninstall.                            | No cross-app logic. `orca-install-identity.ts:26` (`ORCA_BUNDLE_ID`) and its cask list read S2 in packaged tmwk, so tmwk's uninstaller looks only for other tmwk builds. Turning hooks off, disabling an agent or uninstalling tmwk removes only tmwk's entries, because its matcher only matches its own. The same holds for Orca, without any change to Orca.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S9  | The global CLI.                                   | `tmwk`, never `orca`, for the packaged app (revisits D48 for packaged only). macOS: a second launcher, `Resources/bin/tmwk`, and `/usr/local/bin/tmwk` (or `~/.local/bin/tmwk`). Linux: `~/.local/bin/tmwk`. Headless serve in packaged tmwk installs `tmwk`, never the generic `orca` bare dispatcher (`serve-cli-registration.ts:8-59`, `linux-bare-orca-dispatcher.ts:22`). Windows: a separate folder, `resources\bin-global`, on the user PATH. It cannot be `resources\bin`, which is also the in-terminal `orca` folder (`cli-install-location.ts:241`, `src/main/cli/cli-installer.ts:141-150`). The global `tmwk` launcher sets tmwk's own env (S17), so it reaches tmwk from any terminal, Orca's included.                                                                                                                                                                                                                                                                                                                                                   |
| S10 | `orca` inside tmwk's terminals.                   | **Decided (owner, 2026-11-20): "keep orca working for now but plan on a way to get this to be tmwk only."** For v0, `orca` keeps working inside tmwk's terminals as a tmwk binary, and `tmwk` works beside it (S9). The move to `tmwk` only is planned as [Later: P6](#later-p6-tmwk-only-command). Upstream's skills type `orca` (they fall back to it when `$ORCA_CLI_COMMAND` is unset, `skills/orchestration/SKILL.md:24-34`), and so do the worker preamble (`render-worker-preamble.ts`) and the partner prompt (`resources/tmwk/main-partner.md`). Inside a tmwk terminal, `orca` is tmwk's own `Resources/bin/orca`, first on PATH (`orca-cli-child-path.ts:67-78`, restored after zsh and bash rc files by `orca-cli-shell-path.ts:1-6`). It shares no file or state with Orca's command. The gaps (Windows has no restore; fish is **(verify)**) are risks, not P2 work. Don't add new tmwk text that types a literal `orca`. Read `$ORCA_CLI_COMMAND` or say `tmwk`, so P6 has less to change.                                                               |
| S11 | Where updates come from.                          | Add `APP_RELEASE_REPO` to `src/shared/updater/release-channel.ts`, read from S2's `releaseRepo` in packaged tmwk. Map stable and RC to it, and use it in the four runtime files that hard-code `stablyai/orca`. `MAIN_RELEASE_REPO` stays `stablyai/orca` for the WSL hosts policy and agent-state-rules downloads. Those are upstream's public data, which tmwk reads like any website; they are not state shared with Orca. The dev channels (hourly, daily, adhoc) are hidden in packaged tmwk: their repositories don't exist (brand plan, "Channels for tmwk").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| S12 | Signing knobs the overlay can't reach.            | One Extend at the top of upstream's builder config: `ORCA_MAC_TEAM_ID` reads `process.env.ORCA_MAC_TEAM_ID_OVERRIDE` when it is set, and the usage strings take their product name from `process.env.ORCA_BUILDER_PRODUCT_NAME` (default `Orca`). The `afterPack` closures capture the team id and usage strings at module load (`:259`, `:903`, `:915-916`), so an overlay override does not reach the terminal-host helper. The overlay sets both env vars before its `require()`. These are build-machine variables, never in a user's environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S13 | Windows signing.                                  | Unsigned when Windows ships (owner, second round). v0 ships no Windows build (S21). The overlay leaves `publisherName` unset. `NsisUpdater.verifySignature` then skips the Authenticode check (`node_modules/electron-updater/out/NsisUpdater.js:84-99`, electron-updater 6.8.12). Never set `verifyUpdateCodeSignature: false`, and never disable it in code (`updater-setup.ts:170`). If Windows signing arrives later, the first signed release must be installed by hand: a build with a baked `publisherName` rejects every unsigned installer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| S14 | URL scheme.                                       | `tmwk://` for the desktop's two routes, `skills/share/<id>` and `plugins/<id>` (`skill-share-link.ts:15,33`, `plugin-install-link.ts:11,27-33,69`). tmwk never registers `orca://`. The parsers also accept a pasted `orca://plugins/…` or `orca://skills/share/…` link, so S18's plugin links work. Accepting pasted text is not sharing. The **pairing payload stays `orca://pair?code=`** (`src/shared/remote-runtime/pairing/pairing.ts:19`). It is read by upstream's phone app, which owns `orca` on the phone (`mobile/app.json:9`) and parses only that form (`mobile/src/pairing/pairing.ts:29-35`). No desktop opens it.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S15 | Remote hosts and WSL.                             | **Possible later, not built now (owner, 2026-11-20).** Assume one SSH host will someday be connected from both apps, but v0 does not build for it. In v0, tmwk's remote runtime behaves as upstream's does: `~/.orca` and `~/.orca-remote` on the host, `ORCA_*` env there, and `~/.orca/agent-hooks` hooks there. Connecting one host from both apps is unsupported in v0 (see [Risks](#risks)). WSL waits with Windows (S21). Choices that must not block the later work: S2 already reserves `homeDirName` and `remoteInstallDirName` for the host; S17's boundary functions take an env and know nothing about the local machine, so `orcad` can call them later; P3b's hook seams take the home folder as an argument, not `homedir()`; new tmwk code never hard-codes `~/.orca` on a host. The later step is [P3c](#later-p3c-remote-hosts-and-wsl).                                                                                                                                                                                                              |
| S16 | Moving existing dev data.                         | **No automatic migration.** The installed tmwk starts fresh. The user copies the tmwk store and keybindings by hand before first launch (see [Moving your existing data](#moving-your-existing-data)). Profile databases, sessions, paired devices and keypairs are tied to their userData, and copying them under a new app identity would give a phone two hosts that claim the same key. **Decided (owner, 2026-11-20):** hand-copy is fine.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S17 | Environment variables.                            | **No `ORCA_*` variable ever leaves a packaged tmwk process, and none from outside is ever read by one.** About 780 `ORCA_*` names appear in about 960 source files, so tmwk does not rename them in code. It renames them at the process boundary, through two pure functions in Own `src/shared/tmwk/app-identity/app-env-boundary.ts`. **Outbound**, at every place packaged tmwk builds a child's environment: each `ORCA_X` becomes `TMWK_X`, and no `ORCA_*` key is left. **Inbound**, first thing in every tmwk entry point (CLI, `orcad`, daemon, relay, plugin host, WSL guest): every inherited `ORCA_*` is dropped as foreign, and each `TMWK_X` is copied to `ORCA_X`, so the code inside keeps reading the names it always has. Scripts tmwk writes for agents to run read the `TMWK_*` names directly (P3b). A check in CI keeps tmwk's own names (`TMWK_HOME`, `TMWK_AWAY_AFTER_SECONDS`, …) from equaling `TMWK_` + an upstream `ORCA_` suffix. **Owner call** (decided).                                                                                |
| S18 | Plugins.                                          | **The one exception: Orca plugins work in tmwk.** That means the same manifest and plugin API, the same official and community catalogs (`plugin-marketplace.ts:21,23,228`, read like any website), and pasted `orca://plugins/…` links (S14). Each app installs its own copies: plugins live in `userData/plugins` and `userData/plugins-data` (`plugin-discovery.ts:71,75`), so they separate when userData does (P1). The plugin host is a tmwk process (`plugin-host-process.ts`). After S17's inbound step it gives plugins the `ORCA_*` names they were written against **(verify** which env, if any, plugins read**)**.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S19 | Agent settings with one slot.                     | Some agent settings hold one value. Claude's `statusLine` is one; the Claude theme is probably another **(verify)**. Upstream already keeps a status line it doesn't recognise: "A user-owned status line takes precedence over Orca's usage feed" (`claude/hooks/hook-settings.ts:262-293`). With S7's separate matchers, Orca's status line looks user-owned to tmwk, and tmwk's looks user-owned to Orca, so the first app to claim the slot keeps it and the other leaves it alone. **Decided (owner, 2026-11-20):** accepted. That is a rule about values that aren't its own, not knowledge of Orca. Theme sync moves to `~/.tmwk/claude-theme-sync.json` (`claude-code-theme-ownership.ts:25-26`) and must follow the same rule **(verify)**.                                                                                                                                                                                                                                                                                                                    |
| S20 | Where releases are built.                         | **Locally, never in GitHub Actions (owner, 2026-11-20: Actions stays off for cost).** The release build, signing, notarization and the upload to `tmwkdev/tmwk-app` Releases run on the MacBook Air (Apple Silicon, the owner's laptop), or the homelab later, from one Own script, `config/tmwk/scripts/release-tmwk-mac.mjs` (P5). The Developer ID certificate lives in the Air's login Keychain, and the MBP holds no signing secret. Notarization credentials live in a `notarytool` Keychain profile there, never in the repository or a shell profile. The host itself (mirror, worktrees, `gh` login) is the subject of the [local CI plan](local-ci-plan.md) and its ticket, which already puts release and signing on the Air (its decision 5) while the MBP runs the nightly. This guide only adds the release script that runs on that host. With Actions off, upstream's workflows never run in `tmwkdev/tmwk-app`, guarded or not.                                                                                                                        |
| S21 | Platforms and version for v0.                     | **A macOS-only beta, version `0.1.0` (owner, 2026-11-20).** The release publishes only the macOS dmgs, zips, blockmaps and `latest-mac.yml`. Windows and Linux are **Not tested** for v0, and no Windows or Linux artifact is published. Their code still follows AGENTS.md's cross-platform rule (runtime guards, the paths in P1–P4), so the later release is a build-and-test step, not a redesign. **Decided (owner, 2026-11-20): "beta" goes in the release title for the foreseeable future**, for example `tmwk 0.1.0 (beta, macOS)`. Each release is a normal GitHub release, never a prerelease, and the version carries no `-beta` suffix. A prerelease is skipped by `releases/latest`, which is the stable feed (S11) **(verify** in P5**)**. tmwk's version line starts at `0.1.0`, separate from upstream's `1.4.x`.                                                                                                                                                                                                                                      |
| S22 | Telemetry and diagnostics.                        | **None to Orca.** Telemetry turns on only when the build bakes in `ORCA_BUILD_IDENTITY` and `ORCA_POSTHOG_WRITE_KEY` (`src/main/telemetry/client.ts:25-37`), and diagnostics upload needs `ORCA_DIAGNOSTICS_TOKEN_URL` (`electron.vite.config.ts:41`). The release script never sets Orca's write key or the diagnostics URL, so both stay off. This follows from "no impact on each other": tmwk's events would otherwise land in Orca's analytics. The release script **does** set `ORCA_BUILD_IDENTITY=stable`: PostHog still needs a write key, and with an identity set the diagnostics endpoint is pinned to the build's `null` and a runtime env var can't override it (`diagnostic-upload-endpoint.ts:19-30`). The feedback, crash and language-request forms copy the report and open a GitHub issue on `tmwkdev/tmwk-app` instead of posting to `orca.dev/v1/feedback`. Later stages (tmwk's own PostHog project) are in [telemetry-plan.md](telemetry-plan.md).                                                                                              |

## What is shared with Orca

Nothing, apart from S18's plugin compatibility. Bundle id, userData (and the plugins installed in it), Keychain item, single-instance and profile locks, home folder, hook scripts and settings entries, install lock, global command, desktop URL scheme, environment variables, update feed, updater cache, launchd labels are all separate. Remote-host and WSL data are not separated in v0 (S15): a host should be connected from one app only until the later P3c.

Both apps do use some of the same outside things. Neither owns them, and they hold no state of one app that the other reads:

| Outside thing                                                                    | How tmwk uses it                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each agent's settings file (`~/.claude/settings.json`, `~/.codex/hooks.json`, …) | tmwk adds and removes only its own entries (S7). S19 covers one-value settings. Concurrent writes are a risk (see [Risks](#risks))                                                        |
| Agents' own homes and accounts (`~/.claude`, `~/.codex`, …)                      | The agents' own data. Both apps launch the same installed agents                                                                                                                          |
| Upstream's phone app, `orca://pair` and upstream's relay                         | The phone pairs with each desktop as a separate host, because each has its own keypair in its own userData (`runtime-e2ee-keypair-file.ts:5`). Each app signs in to Orca Cloud on its own |
| Upstream's plugin catalogs and public data feeds                                 | Read-only downloads (S11, S18)                                                                                                                                                            |

## Agent hooks in detail

This is the check the brand plan asked for before P3 (open item 2).

**How a hook finds its app today.** Every managed hook entry runs a fixed script, `"${HOME-}/.orca/agent-hooks/<agent>-hook.sh"`. The script runs only if `ORCA_PANE_KEY` or `ORCA_AGENT_PANE` is set; otherwise it drains stdin and prints `{}` (`runtime-home-hook-command.ts:27,34,49,82`; guard at `posix-hook-command.ts:10`). It then loads `ORCA_AGENT_HOOK_ENDPOINT`, a file in the launching app's userData. If the port, token or pane key is still missing, it exits 0. Otherwise it posts to `127.0.0.1:$ORCA_AGENT_HOOK_PORT` with that app's token (`hook-script.ts:76-122`, `hook-post-command.ts:60-96`). The token is new on every server start, and a wrong one gets a 403 (`server-lifecycle.ts:52,67-71`).

**Why moving the folder alone fails.** The matcher searches for `agent-hooks/<stem>` anywhere in the command (`managed-hook-command-matching.ts:9-32`). Install removes every match and appends one (`claude/hooks/hook-settings.ts:224-260`). So `~/.tmwk/agent-hooks/claude-hook.sh` would be deleted by Orca and Orca's by tmwk, on every start. Each status check would report "not installed", and Codex's trust entries in `config.toml` would be rewritten each time. With a different path but the same `ORCA_*` env, both scripts would post every event to the launching app: double delivery.

**How S7 and S17 separate them.**

| Agent started in  | Orca's entry runs `~/.orca/agent-hooks/…`                                                                                             | tmwk's entry runs `~/.tmwk/hooks/…`                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A tmwk terminal   | Finds no `ORCA_PANE_KEY` or `ORCA_AGENT_PANE` (S17 renamed them on the way out). Its command-level guard drains stdin and prints `{}` | Reads `TMWK_*`, posts once to tmwk                               |
| An Orca terminal  | Posts once to Orca, as today                                                                                                          | Finds no `TMWK_PANE_KEY`. Its guard drains stdin and prints `{}` |
| Outside both apps | Prints `{}`                                                                                                                           | Prints `{}`                                                      |

The cost is one extra no-op script run per hook event. Neither matcher matches the other's entries, so install, update, turning hooks off, disabling an agent and uninstall each touch only their own app's entries. Script drift between versions no longer matters, because each app runs only the scripts it wrote.

**One leak S17 must cover.** An app started from a terminal of the other inherits that terminal's environment. A tmwk started from an Orca terminal would then pass Orca's `ORCA_AGENT_HOOK_PORT` on to its own terminals, and Orca's script would post tmwk-pane events to Orca. S17's inbound step drops every inherited `ORCA_*`, which closes this. The reverse case is an Orca started from a tmwk terminal (by its binary, not through `open`). It would pass `TMWK_*` on to Orca's terminals, where tmwk's script would post to tmwk with a valid token and an unknown pane key. tmwk's hook server must reject pane keys it never issued **(verify** whether it already does**)**.

## Build order

P0 first. P1 follows P0. P2, P3 and P4 can run in parallel after P1. P3b follows P3. P5 follows all of them. P3c is not part of v0 (S15); it is kept below as the later step so the v0 steps don't block it. P6 (`tmwk` only, S10) is also later. Each step is one reviewable PR. Until P3b merges, a packaged tmwk shares hook entries with Orca. Never distribute a packaged build before P5, and never run one beside Orca before P1.

### P0. The overlay and a local unsigned `tmwk.app`

Add:

- `src/shared/tmwk/app-identity/tmwk-app-identity.json` and `tmwk-app-identity.ts` (S2, Own).
- `config/tmwk/electron-builder.tmwk.cjs` (S3, Own). Fields:
  - `appId: 'dev.tmwk.app'`, `productName: 'tmwk'`, `extraMetadata: { ...upstream.extraMetadata, name: 'tmwk' }`.
  - `protocols: [{ name: 'tmwk', schemes: ['tmwk'] }]`.
  - `win.executableName: 'tmwk'`, `linux.executableName: 'tmwk'`, `linux.desktop` `StartupWMClass: 'tmwk'`, `linux.maintainer: 'tmwkdev'`.
  - `dmg.artifactName: 'tmwk-macos-${arch}.${ext}'`, `nsis.artifactName: 'tmwk-windows-setup.${ext}'`, `appImage.artifactName: 'tmwk-linux.${ext}'` (and the arm64 name), deb/rpm `packageName: 'tmwk'` with tmwk artifact names. The zip `artifactName` is unset upstream; set `tmwk-macos-${arch}.${ext}` explicitly so the updater manifest names a tmwk file.
  - `publish: { provider: 'github', owner: 'tmwkdev', repo: 'tmwk-app', releaseType: 'draft' }`.
  - `mac.extendInfo`: upstream's usage strings with "Orca" replaced by "tmwk". The env from S12 covers the terminal-host helper's copy.
- `config/tmwk/scripts/build-tmwk-mac-local.mjs` (Own), a copy of `build-mac-local.mjs:31-45` that passes `--config config/tmwk/electron-builder.tmwk.cjs`. `isMacRelease` stays false, so the build is ad-hoc signed (`:874`, `:934`).
- `package.json` scripts (Extend): `tmwk:build:mac`, `tmwk:build:win`, `tmwk:build:linux`, `tmwk:build:unpack`.

Change:

- `config/electron-builder.config.cjs` (Extend, S12): the two env reads.
- `resources/darwin/bin/orca:22` (Extend): read the executable from `Contents/Info.plist`'s `CFBundleExecutable` (`/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable'`) instead of the literal `Orca`. `Helpers/Orca Agents.app` (`:75-76`) and `Orca Computer Use.app` keep their file names. They live inside `tmwk.app`, and their bundle ids derive from the app's (`macos-terminal-host-bundle.cjs:214,240`) **(verify** that both helpers really take the app's id, so they never share Orca's TCC grants**)**.
- `src/main/macos-permissions/macos-tcc-prompt-watch.ts:12-17` (Extend): in packaged tmwk, watch tmwk's ids (`dev.tmwk.app`, `dev.tmwk.app.helper`) in place of Orca's.

Acceptance:

- `pnpm tmwk:build:mac` produces `dist/mac-arm64/tmwk.app` and `tmwk-macos-arm64.dmg`. `Info.plist` shows `CFBundleIdentifier` `dev.tmwk.app`, `CFBundleName` `tmwk`, `CFBundleURLSchemes` `tmwk`.
- `Contents/Resources/app-update.yml` names `tmwkdev` / `tmwk-app` and `updaterCacheDirName: tmwk-updater`.
- In a throwaway macOS user account with no Orca, `tmwk.app` launches (right-click → Open past Gatekeeper). Inside a tmwk terminal, `orca --help` works. This proves the launcher fix.
- `pnpm build:mac` (upstream's config) still produces an identical `Orca.app`, apart from the launcher line.

Depends on: nothing. Do not launch it beside a running Orca until P1.

### P1. userData, Keychain and the single-instance lock

Change (Extend, one value each, read from S2):

- `src/cli/runtime/profile/metadata.ts:57-71`: `orca` → `userDataDirName`. This is the packaged default only. `ORCA_USER_DATA_PATH` still wins inside tmwk processes (`:42-50`).
- `src/main/codex/configuration/homes/codex-home-paths.ts:74-86` (`getOrcaUserDataPath`): the same.
- `src/shared/remote-runtime/serve-supervisor/serve-bundle-coordination.ts:48-50`: the same. `:6` uses `labelPrefix`.
- `src/main/daemon/executable-host/macos/macos-daemon-job-label.ts:11`: `labelPrefix`.
- `src/main/observability/logs-directory.ts:7-19`: `Orca` → the identity's product folder.
- `src/main/command-code/command-code-managed-script.ts:26-30,117-124`: in packaged tmwk, scan tmwk's endpoint paths only.
- `src/cli/runtime/serve/supervision/serve-service-unit.ts:68-85`: the log folder `~/Library/Logs/Orca` follows the identity.

Leave alone: `configure-process.ts:234` (dev's `orca-dev`), and everything that matches `orca-dev` to detect dev mode (`coordinator-task-dispatch.ts:105`, `runtime-compatibility.ts:41`).

Spikes to answer first, and record in this guide:

- Does packaged `app.getPath('userData')` return `…/Application Support/tmwk` with `extraMetadata.name: 'tmwk'`? Does `getCanonicalUserDataPath()` (captured early) equal a late `getPath('userData')` (after `app.setName('tmwk')`)? If `extraMetadata.name` does not move it, the fallback is one Extend line in preflight: `app.setPath('userData', join(app.getPath('appData'), userDataDirName))` for packaged builds, before `configureOrcaUserDataPathEnv` (`main-process-preflight.ts:195`).
- On Windows, `windows-app-data-path.ts:53` sets `appData/<getName()>`. Confirm `getName()` is `tmwk` at that point.
- Which Keychain item does packaged tmwk create? Expected `tmwk Safe Storage`, from `CFBundleName` (`dev-instance-identity.ts:17`). Check with `security find-generic-password -s "tmwk Safe Storage"`.
- Electron's `requestSingleInstanceLock` is per userData. Confirm by running both apps. The second lock, `acquireDesktopProfileLockOrExplain(getCanonicalUserDataPath())` (`main-process-preflight.ts:252`), is keyed on userData by construction.

Acceptance:

- With Orca running, tmwk launches, and the reverse. Each shows its own window, its own repos and its own installed plugins.
- `~/Library/Application Support/tmwk` exists, and Orca's `…/orca` is unchanged (hash before and after).
- The Keychain has `tmwk Safe Storage` beside `Orca Safe Storage`.

Depends on: P0.

### P2. The `tmwk` command and the PATH shim

Add:

- `resources/tmwk/darwin/bin/tmwk` (Own): the macOS launcher. A copy of `resources/darwin/bin/orca` with P0's `CFBundleExecutable` lookup. It drops inherited `ORCA_*` and `TMWK_*` routing variables, then sets `TMWK_USER_DATA_PATH="$HOME/Library/Application Support/tmwk"` and `TMWK_APP_HOME_DIR="$HOME/.tmwk"`. The CLI's inbound step (S17, P3b) turns the first into `ORCA_USER_DATA_PATH`. Until P3b lands, it sets `ORCA_USER_DATA_PATH` directly. The overlay adds it to `mac.extraResources` as `bin/tmwk`. `bin/orca` stays for in-terminal use.
- `resources/tmwk/linux/bin/tmwk` (Own): the same for Linux, with XDG paths.
- `resources/tmwk/win32/bin-global/tmwk.cmd` (Own): Windows, a `.cmd` wrapper around the bundled `orca.exe` that sets the same variables (**verify** that a `.cmd` on PATH is enough for agents and shells, or whether a `tmwk.exe` copy of `native/windows-cli-launcher` is needed).

Change (Extend):

- `src/main/cli/installation/cli-install-constants.ts:1` and `cli-install-location.ts:68-74,91-95,213-245`: in packaged builds the command name and paths come from `cliName`: `/usr/local/bin/tmwk` or `~/.local/bin/tmwk` on mac, `~/.local/bin/tmwk` on Linux, and `resources\bin-global` on the Windows user PATH.
- `src/main/cli/packaged-assets/bundled-cli-launcher-path.ts:7-21`: the global launcher is `bin/tmwk` (mac, Linux) or `bin-global\tmwk.cmd` (Windows). The darwin "managed" regex (`cli-command-inspection.ts:132-136`) matches on `basename(launcherPath)`, so after this change it matches only `…/bin/tmwk`. Orca's `/usr/local/bin/orca` then becomes a conflict, never "stale".
- `src/main/startup/serve-launch/serve-cli-registration.ts:8-59`: packaged tmwk never installs the Linux bare `orca` dispatcher.
- `src/renderer/src/components/settings/cli/install/CliSection.tsx:41-56`: the copy shows `status.commandName`, not a literal `orca`.
- `src/main/cli/launchers/orca-cli-child-path.ts:67-78`: packaged mac and Windows also set `ORCA_USER_DATA_PATH`, as the Linux branch does, so an in-terminal `orca` never falls back to a default path **(verify** whether `baseEnv` already carries it from `process.env`**)**. S17 renames it on the way out.

Acceptance:

- With Orca's `/usr/local/bin/orca` installed, "Install command" in tmwk installs `/usr/local/bin/tmwk` and leaves `orca` pointing at Orca.app (`readlink` before and after).
- From a plain Terminal.app and from an Orca terminal, `tmwk status` reports tmwk's runtime. `orca status` from a plain Terminal.app reports Orca's.
- Inside a tmwk terminal, `which orca` is tmwk's `Resources/bin/orca`, and `orca orchestration check` reaches tmwk. The same holds after `exec zsh`.
- Windows: `tmwk` resolves in a new PowerShell. `orca` resolves to Orca's entry outside tmwk and to tmwk's inside tmwk's terminals.

Depends on: P1.

### P3. `~/.tmwk` on the desktop

Start with the inventory. Record it in this guide as a table: path, file:line, what moves. The research list is in [`~/.orca` sites](#orca-sites). Every row moves. Hook files move in P3b.

Add:

- `src/shared/tmwk/app-identity/app-home-dir.ts` (S5, Own).

Change (Extend):

- `src/main/startup/configure-process.ts`: in packaged builds, set `process.env.TMWK_APP_HOME_DIR = join(home, homeDirName)` next to `configureOrcaUserDataPathEnv`.
- Each desktop-host site from the inventory: `join(homedir(), '.orca')` → `appHomeDir()`. At least 8 files define their own private `getOrcaDir()`. Replace the body, not the callers.
- `src/main/uninstall/orca-install-identity.ts:26-32` (S8): the bundle id, casks and Linux package name come from S2 in packaged tmwk. `orca-uninstall-cleanup.ts:80,222-226`, which deletes the home folder when it is empty, then acts on `~/.tmwk`.

Acceptance:

- After using tmwk (keybinding change, Linear sign-in, a MiniMax key), the new files are in `~/.tmwk`, and `~/.orca` is byte-for-byte unchanged apart from hook files (P3b).
- A key Orca sealed in `~/.orca` is never opened by tmwk. Today the two apps would get `sealed-elsewhere` from each other (`saved-credential-readability.ts:29-77`). After P3 they never look at each other's files.
- Source and dev runs still write `~/.orca` (no `TMWK_APP_HOME_DIR` set).

Depends on: P1.

### P3b. Separate hooks and the environment boundary

The biggest step. It is in upstream's busiest code (16 agent installers), so it is built around two seams rather than many edits.

Spikes to answer first, and record in this guide:

- **Outbound points.** List every place packaged tmwk builds a child process's environment. The research found at least: PTY env assembly (`ipc/pty/host-env/assembly.ts:287-308`, `spawn-host-env.ts:249`, `local-configure.ts:93`), structured sessions (`structured-session-child-env.ts:96-101`), workspace hooks (`hook-orca-cli-env.ts:30-31`), the daemon (`daemon-launched-child-spawn.ts:98`, `macos-daemon-launchd.ts:64`), serve units (`serve-service-unit.ts:68-85`), the local `orcad` launch (`serve-orcad-launch.ts:90`) and the plugin host (`plugin-host-process.ts`). The SSH launch (`orcad-remote-launch.ts:105`) is left out in v0, so a host keeps `ORCA_*` as today (S15); P3c adds it with the host's inbound step. Find the rest with a dump: every child of a packaged tmwk, `ps eww`, no `ORCA_*`.
- **Inbound points.** Every entry point of a tmwk process on the desktop: `src/cli/index.ts`, `src/main/orcad/main.ts` when started locally, the daemon and relay entries, and main itself (for a tmwk started from an Orca terminal). The WSL guest and `orcad` on a remote host wait for P3c.
- **Text tmwk writes for others to run.** Hook scripts (`managed-hook-script-write.ts:24-35`), hook command strings (`runtime-home-hook-command.ts`, `codex-hook-command-form.ts`, `claude/hooks/hook-settings.ts:176`), shell startup wrappers (`zsh-startup-wrapper-builder.ts`, `local-pty-shell-ready-bash-rcfile.ts`), the OpenCode plugin and the pi/omp/prime extensions (`agent-status-extension-source.ts`, `status-plugin-endpoint-source.ts`), and the static launchers in `resources/*/bin`. Find out whether one rewrite at write time can cover them: in packaged tmwk, `\bORCA_` → `TMWK_` in the generated text. Otherwise list a per-writer change.
- Does the hook server reject a pane key it never issued?

Add (Own):

- `src/shared/tmwk/app-identity/app-env-boundary.ts`: `toChildEnv(env)` and `fromInheritedEnv(env)` (S17), plus the name-clash check as a test.
- `src/shared/tmwk/app-identity/app-hook-paths.ts`: tmwk's script path, `<home>/hooks/<name>`, and its matcher. The home folder is an argument, so P3c can call it for a remote host (S15).

Change (Extend):

- Each outbound point: wrap the final env in `toChildEnv` when packaged. Each inbound point: call `fromInheritedEnv(process.env)` first when packaged.
- `getSharedManagedScriptPath` (`managed-hook-script-path.ts:5-6`), `jcode/hook-settings.ts:40` and `createManagedCommandMatcher` (`managed-hook-command-matching.ts:9-32`): use `app-hook-paths.ts` when packaged. Those three seams cover the 16 installers that call them. The hard-coded command strings above need their own lines.
- Markers and names (S7): the Windows native hook executable, the Codex command-form marker, the OpenCode plugin file name, the pi extension marker, `managed-hook-install-lock.ts:52-53`, `grok/grok-hook-owners.ts:13`.
- Codex trust: tmwk's entries get their own trust records. Orca's trust cleanup (`codex-hook-trust-cleanup.ts:184`) must not match them **(verify)**.
- S19: theme sync's file path and its one-value rule.

Acceptance:

- In a tmwk terminal, `env | grep '^ORCA_'` prints nothing. The same holds for an agent's environment (`ps eww <pid>` of a Claude started there) and for the daemon.
- `~/.claude/settings.json` holds Orca's entry and tmwk's entry for each hook event. A Claude session in each app shows live status in its own app, once. Each hook server logs one event per hook, not two (runbook check 4).
- Turn hooks off in tmwk: Orca's entries are unchanged (diff of the settings file).
- `tmwk status` from an Orca terminal reaches tmwk, and an agent in tmwk started from that terminal still reports to tmwk.
- Source and dev runs are unchanged: `~/.orca/agent-hooks`, `ORCA_*` in terminals.
- A terminal on an SSH host opened from tmwk still works and reports to tmwk, with the host's `~/.orca` layout (S15).

Depends on: P3.

### Later: P3c. Remote hosts and WSL

Not built for v0 (S15). Kept here so v0's choices leave room for it. When it is built:

Change (Extend, values from S2): the roughly 25 remote-host paths in the research list (`orcad-app-paths.ts:14-21`, `orcad-remote-context.ts:151,185`, `orcad-machine-home.ts:27,320-326`, `remote-install-root.ts:1`, `orcad-cli-launcher.ts:32-46`, `wsl-host-uninstall-server-stop.ts:24`, `wsl-distro-holder-command.ts:25,32`, `wsl-host-ssh-orcad-conflict.ts:15`). Add the remote hook installers, which follow P3b's seams where they use them, plus their own lines for literal paths (for example `claude/hook-service.ts:239`, `codex-hook-remote-install.ts:43-44`, `grok-hook-remote-install.ts:50`). Then the WSL relay and guest folders, bridge, markers and command name (S15).

Acceptance:

- Connect the same SSH host from both apps. The host has `~/.orca` and `~/.orca-remote` for Orca, and `~/.tmwk` and `~/.tmwk-remote` for tmwk. A terminal on the host opened from each app reports to its own app, and `env | grep '^ORCA_'` is empty in tmwk's.
- WSL: both apps' CLIs register without overwriting each other's bridge. Mark **Not tested** without a Windows machine.

Depends on: P3b, and a decision to support one host from both apps.

### P4. The `tmwk://` scheme

Change (Extend, values from S2):

- `src/main/startup/open-routing/orca-protocol-registration.ts:15,19,21` (Windows packaged registration): the scheme comes from the identity.
- `src/shared/skills/sharing/skill-share-link.ts:15,33` and `src/shared/plugins/catalog/plugin-install-link.ts:11,27-33,69`: accept `tmwk:`, and keep accepting pasted `orca:` links (S14, S18). `isRoutedOrcaDeepLink` (`orca-deep-link-url.ts:5-7`) then follows.
- `src/main/window/activation/macos-desktop-handoff.ts:82`: rebuild the link with the running app's scheme.
- Where tmwk builds a share link for others (`SkillsPage.tsx:172` builds `https://app.orca.dev/skills/share/<id>`): leave it. It is upstream's web page, and it opens whichever app owns `orca://`.

Leave alone: every pairing producer and parser (`pairing.ts:19,41,64`, `web-pairing.ts:46,74,184`, the CLI pairing help).

Pairing with upstream's mobile app:

- The QR code still says `orca://pair?code=…`. The phone app reads it through its own `orca` scheme. Neither desktop is asked to open it.
- tmwk has its own keypair and device registry in its own userData (`host-instance-identity.ts:18-22`), so the phone lists tmwk as a second host beside Orca. The host catalog keys hosts by public key (`mobile/src/host-catalog/host-store.ts:94-104`).
- Relay pairing needs tmwk's own Orca Cloud sign-in (`relay-http-client.ts:149-165`, `login.onorca.dev`). `local-only` pairing needs none (`runtime-rpc-mobile-pairing.ts:46`).
- Moving to packaged tmwk means pairing the phone again. The dev profile's pairing does not carry over (S16).

Acceptance:

- `open 'tmwk://plugins/<id>?catalog=official'` opens tmwk's plugin preview, and `open 'orca://plugins/<id>…'` opens Orca's.
- Pasting an `orca://plugins/…` link into tmwk previews the plugin, and installing it puts it in tmwk's `userData/plugins` only.
- A phone already paired with Orca pairs with tmwk too and lists two hosts. Mark **Not tested** without a phone.

Depends on: P1.

### P5. Updates, signing and the public release

Change (Extend):

- `src/shared/updater/release-channel.ts:22-38` (S11): add `APP_RELEASE_REPO`, `tmwkdev/tmwk-app` in packaged tmwk. Map stable and RC to it. Hide the dev channels (`:51-55`) in packaged tmwk **(verify** that the build picker and settings handle an empty dev-channel list**)**.
- `src/main/updater/lifecycle/updater-setup.ts:172-175`, `updater-prerelease-feed.ts:15,20,72,78` and `updater-release-readiness.ts:4,110`: build their URLs and regexes from `APP_RELEASE_REPO`.
- Release-notes links (`getReleaseNotesUrlForVersion`, `release-channel.ts:178-184`) follow, since they read the channel's repo.
- The nudge and changelog URLs (`nudge-campaign.ts:12`, `updater-changelog.ts:13,32`, all `orca.dev`) are turned off in packaged tmwk. Today they would show Orca's "what's new" inside tmwk.

Add (Own):

- `config/tmwk/scripts/release-tmwk-mac.mjs` (S20). Run on the Air from a clean worktree at the release tag: `node config/tmwk/scripts/release-tmwk-mac.mjs v0.1.0`. It:
  1. Refuses to run unless the worktree is clean, `HEAD` is the tag, `package.json` `version` matches it, and `gh auth status` succeeds.
  2. Checks the signing setup: a `Developer ID Application` identity in the login Keychain (`security find-identity -v -p codesigning`) and the `notarytool` profile (`xcrun notarytool history --keychain-profile tmwk-notary`).
  3. Runs upstream's release preflight that applies: `pnpm verify:macos-entitlements`, then `pnpm run build:release` with `NODE_OPTIONS=--max-old-space-size=4096`. It sets `ORCA_BUILD_IDENTITY=stable`, unsets `ORCA_POSTHOG_WRITE_KEY` and `ORCA_DIAGNOSTICS_TOKEN_URL`, and never sets Orca's values for either (S22). After packaging, it runs `node config/tmwk/release/verify-tmwk-no-telemetry.mjs dist`, which fails if any `app.asar` carries a PostHog key or `orca.dev/diagnostics` / `orca.dev/v1/feedback`. Upstream's `verify-telemetry-constants.mjs` is not run: it requires a key.
  4. Builds arm64 and x64 with `--config config/tmwk/electron-builder.tmwk.cjs`, `ORCA_MAC_RELEASE=1` (hardened runtime, notarization, `forceCodeSigning`), `ORCA_MAC_TEAM_ID_OVERRIDE`, and notarization through the Keychain profile (`APPLE_KEYCHAIN_PROFILE=tmwk-notary`) in place of the `APPLE_ID` and password pair. With the certificate in the Keychain, `CSC_LINK` is not needed **(verify** both with electron-builder 26.15.3; upstream's `verify-macos-release-env.mjs` demands all five Apple variables, so the script skips it and does its own check in step 2**)**.
  5. Publishes the assets to a **draft** release on `tmwkdev/tmwk-app` (`--publish always` with `GH_TOKEN=$(gh auth token)`, through the overlay's `publish`), then runs `gate-mac-update-manifests.mjs` against the draft **(verify** it accepts tmwk's artifact names**)**.
  6. Prints the draft's URL. The owner checks the assets and publishes it by hand, titled `tmwk 0.1.0 (beta, macOS)`, as a normal release, not a prerelease (S21).
- A "Releasing" section added to this guide: bump `version`, commit, tag, push the tag, run the script on the Air, check the draft, publish.

Upstream's release pipeline does more than this script. `release-cut.yml` builds the `orcad` deployment template on separate node-server lanes and the release JavaScript once for every platform, and `release-mac-build.yml` runs the file-watcher fault harness. Spike in P5, and record here, which of those the packaged app needs. The `orcad` template matters even with remote hosts deferred if packaged builds fail without it (**verify**: `release-mac-build.yml` downloads it only when the template script exists). Notarization helpers may assume upstream's config path: `build-mac-notarization-overlap.mjs:124` `require()`s it **(verify)**.

Leave alone: upstream's release workflows. GitHub Actions is off in `tmwkdev/tmwk-app` (S20), so none of them run, including the three without a `stablyai/orca` guard (`release-mirror-r2.yml`, `release-javascript.yml`, `homebrew-bump.yml`). If Actions is ever turned on, guard those three first.

Version line: tmwk starts at `0.1.0` (S21), separate from upstream's `1.4.x` (`package.json:3`). The updater compares versions with its own parser (`app-version.ts:6-19,61-95`) and electron-updater's `semver`, and allows no downgrade (`updater-setup.ts:151`). `0.1.0` < `1.4.214` only matters if a tmwk build ever reads Orca's feed, which P5 prevents. **(verify** that nothing else compares the app version with upstream's, such as the `orcad` compatibility contract, `local-build-compatibility-contract.ts`, whose `appId` is also `com.stablyai.orca`**)**.

Acceptance:

- The script on the Air produces a draft release with `latest-mac.yml`, the arm64 and x64 zips and blockmaps, and the dmgs. No Windows or Linux assets.
- `spctl -a -vv tmwk.app` says "Notarized Developer ID". `xcrun stapler validate` passes.
- Install `0.1.0` from the dmg, release `0.1.1` the same way, and `0.1.0` updates itself. Proxy logs show requests only to `github.com/tmwkdev/tmwk-app` for updates, and none to PostHog, `orca.dev/diagnostics` or `orca.dev/v1/feedback` (S22).

Depends on: P0–P4 and P3b, the owner's Apple Developer enrollment (open question 1), and the Air set up as the release host in the [local CI plan](local-ci-plan.md) (a clone, Node and pnpm, `gh` logged in, Rosetta, Xcode Command Line Tools). Until enrollment completes, ship nothing: Squirrel.Mac refuses updates for an ad-hoc-signed app, so a 0.1.0 without notarization would strand its users.

### Later: P6. `tmwk` only

Not built for v0 (S10). The goal: inside tmwk's terminals, agents and skills run `tmwk`, and no `orca` command exists in a packaged tmwk. The seam is already there. `ORCA_CLI_COMMAND` (renamed to `TMWK_CLI_COMMAND` on the wire, S17) tells skills which command to run (`orca-cli-child-path.ts:38,63`, `structured-session-child-env.ts:107`, `ipc/pty/host-env/assembly.ts:293`). What types `orca` today:

- **Bundled skills** (Track): `skills/orchestration`, `orca-cli`, `orca-linear`, `orca-jira`, `linear-tickets`, `jira-tickets`, `orca-emulator`, `orca-emulator-android`, `orca-computer-use`, `orca-plugin-authoring` and `orca-per-workspace-env`. Each falls back to `orca` when `$ORCA_CLI_COMMAND` is unset (`skills/orchestration/SKILL.md:24-34`). Inventory the rest by searching `skills/` for a bare `orca ` command **(verify** the list**)**.
- **tmwk's own text** (Own): `skills/tmwk/SKILL.md` and the partner prompt (`resources/tmwk/main-partner.md`). These change directly.
- **Generated commands**: the worker preamble (`render-worker-preamble.ts`) and the orchestration command name (`OrchestrationCliCommand`, `orchestration-cli-command.ts:12-21`, which returns `orca` for packaged and remote terminals).

Plan, in order:

1. Make sure every packaged tmwk terminal, structured session and workspace hook gets `ORCA_CLI_COMMAND=tmwk`. Add `tmwk` to `OrchestrationCliCommand` and return it in packaged tmwk (Extend).
2. Change the Own text to `tmwk`.
3. For the Track skills, prefer one change over eleven. Either the bundled-skill installer rewrites the `orca` fallback to `tmwk` when it installs skills in packaged tmwk (one Extend in the installer), or upstream accepts skills that never fall back to a literal (offer it upstream). Patching each skill is the last resort.
4. Keep `bin/orca` as a hidden alias for one release that prints "use tmwk" to stderr and then runs. Remove it in the release after that.
5. Remote hosts follow when P3c lands (`~/.tmwk/cli/bin/tmwk` on the host).

Acceptance: in a packaged tmwk terminal, `which orca` finds nothing (after step 4's alias is removed), an orchestration worker's preamble says `tmwk`, and the orchestration skill run by Claude there uses `tmwk`.

Depends on: P2 and P3b.

## Moving your existing data

Today the user's tmwk data lives in three places on the laptop:

| Where                                                                                      | What                                                                                                                                                                                                                       | Moves to the installed tmwk?                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `~/Library/Application Support/orca-dev` (and `orca-dev-wt/<…>` for per-worktree dev runs) | Orca profile state (`orca-data.json`, `profiles/`, `orchestration.db`), sessions, paired devices, the E2EE keypair, installed plugins, `agent-hooks/endpoint.env`, and the dev **tmwk root**, `tmwk/` (no `TMWK_HOME` set) | **Only `tmwk/store/records.json` and `tmwk/store/summary.json`, by hand.** The rest starts fresh |
| `~/.orca`                                                                                  | Keybindings, integration credentials sealed with the `tmwk Dev` Keychain item (Linear, Jira, MiniMax, Z.ai, …), hook scripts                                                                                               | **`keybindings.json`, by hand.** Credentials are entered again. Hook scripts are tmwk's own      |
| `TMWK_HOME`, if the user set one                                                           | Same layout as the dev tmwk root                                                                                                                                                                                           | Same as the first row                                                                            |

Why only those files:

- **`records.json`** holds preferences, notes and briefs. It is the memory the user built, and it has a versioned format with no references to a profile (`tmwk-record-store.ts:58`).
- **`summary.json`** holds working summaries. They are text. Their `sessionId` fields point at old sessions and are only history.
- **`tickets.json`** and **`presence.json`** are not carried over. Ticket snapshots are keyed by Orca task ids in the old profile's `orchestration.db`, and presence is per-run.
- **`main-session.json`** is not carried over. It pins a session in the old profile. The installed app creates its own main session and partner home (`ensure-main-home.ts:26-50`).
- **Profile databases, the keypair and the device registry** are tied to their userData and Keychain item. Copied, they would decrypt nothing (new Keychain item) and make a phone see one key twice.
- **Plugins** are installed again from the catalog (S18).

What the user does by hand, once, before the first launch of the installed tmwk:

```sh
# Quit every dev run first.
SRC="$HOME/Library/Application Support/orca-dev/tmwk"   # or $TMWK_HOME
mkdir -p ~/.tmwk/store && chmod 700 ~/.tmwk ~/.tmwk/store
cp "$SRC/store/records.json" "$SRC/store/summary.json" ~/.tmwk/store/
chmod 600 ~/.tmwk/store/*.json
cp ~/.orca/keybindings.json ~/.tmwk/keybindings.json   # after P3 ships
```

Then, in the installed tmwk: add the repositories again, install the plugins wanted, sign in to Orca Cloud if relay pairing is wanted, pair the phone, enter integration keys (Linear, Jira, MiniMax, Z.ai, and the others), and click "Install command" for `tmwk`. Agent accounts (Claude, Codex) need nothing: they live in the agents' own homes. Remote hosts keep upstream's `~/.orca` layout in v0 (S15), so connect each host from one app only. If the tmwk home host is a remote host, copy the store files on that host instead.

Dev data stays where it is. Source and dev runs keep using it, so the user can run `pnpm dev` beside the installed tmwk. They do not share a store, and a preference set in one does not show in the other. A later step can add `tmwk store import <dir>` if moving the store becomes routine (deferred).

## `~/.orca` sites

The research list for P3's inventory, desktop host only. Every row moves to `~/.tmwk` in packaged tmwk.

| Path under the home folder                                                                | Where it is built                                                                             | Step                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `keybindings.json`                                                                        | `src/main/keybindings/keybinding-file.ts:29`                                                  | P3                                                            |
| `linear-token.enc`, `linear-viewer.json`, `linear-workspaces.json`, `linear-tokens/`      | `src/main/linear/accounts/linear-credential-paths.ts:7-25`                                    | P3                                                            |
| `minimax-session-cookie.enc`                                                              | `src/main/minimax/minimax-cookie-store.ts:18-23`                                              | P3                                                            |
| `minimax-api-key.enc`, `openai-compatible-speech-provider.enc`, `opencode-go-api-key.enc` | `src/main/credentials/encrypted-api-key-file-store.ts:42-48`                                  | P3                                                            |
| `zcode-plan-api-key.enc`                                                                  | `src/main/zcode/zcode-plan-api-key-store.ts:18-19`                                            | P3                                                            |
| `openai-speech-token.enc`                                                                 | `src/main/speech/openai-api-key-store.ts:18-19`                                               | P3                                                            |
| `jira-sites.json`, `jira-tokens/`                                                         | `src/main/jira/site-credential-store.ts:30-40`                                                | P3                                                            |
| `bitbucket-credential.json`                                                               | `src/main/bitbucket/credential-store.ts:48-53`                                                | P3                                                            |
| `orcad` credential root and sealing keys                                                  | `src/main/orcad/credentials/orcad-plaintext-credential-migration.ts:49-51`                    | P3 **(verify** with `orcad-secret-store-startup.ts:9-10`**)** |
| `claude-agent-teams-bin/`                                                                 | `src/main/runtime/terminal/launch/claude-agent-teams-shim-env.ts:104-105`                     | P3                                                            |
| `host-settings/<key>/terminals.json`                                                      | `src/main/daemon/admission/host-terminal-policy.ts:27`                                        | P3                                                            |
| `claude-theme-sync.json`                                                                  | `src/main/claude/theme-sync/claude-code-theme-ownership.ts:25-26`                             | P3b (S19)                                                     |
| `agent-hooks/*`, `agent-hooks/grok-owners/` → `hooks/…`                                   | `managed-hook-script-path.ts:4-6`, `jcode/hook-settings.ts:40`, `grok/grok-hook-owners.ts:13` | P3b                                                           |
| `managed-hook-install.lock`                                                               | `managed-hook-install-lock.ts:52-53`                                                          | P3b                                                           |
| Codex hook-trust files                                                                    | `codex/trust/hooks/codex-hook-trust-cleanup.ts:184` and neighbours                            | P3b **(verify** the list**)**                                 |

The research counted about 64 non-test files that build a `~/.orca` path. About 23 are the desktop sites above, and about 25 are remote-host paths (P3c). The inventories in P3 and P3c must account for every one. Project-local `.orca/` folders (plugin `types`, `shots`, `drops`, browser downloads) live inside a user's repository, not the home folder, and stay.

## Ownership changes

- New Own rows: `config/tmwk/**` (the overlay and its scripts), `src/shared/tmwk/app-identity/**` (covered by `src/shared/tmwk/**`, but list it), `resources/tmwk/darwin/**`, `resources/tmwk/linux/**`, `resources/tmwk/win32/**` (covered by `resources/tmwk/**`). No workflow files: releases are local (S20).
- New Extend rows, each with a patch-log line: `config/electron-builder.config.cjs` (S12), `resources/darwin/bin/orca`, `macos-tcc-prompt-watch.ts`, the P1 path and label files, the P2 CLI install files, `serve-cli-registration.ts` and `orca-cli-child-path.ts`, `configure-process.ts` and each P3 site, `orca-install-identity.ts`, each P3b outbound and inbound point, the hook path and matcher seams and the marker files, the P4 link parsers and `orca-protocol-registration.ts`, and the P5 updater files.
- Expected Extend size: about 8 lines in P1, about 9 in P2, 1 plus about 20 one-line edits in P3, about 20–30 in P3b (one call per boundary point, three seams, the markers), about 6 in P4 and about 10 in P5. P3b is the largest. The later P3c adds about 40. Offer upstream two seams: `orcaHomeDir()` and one function for the hook-script folder and matcher. If upstream takes them, most of P3, P3b and P3c become one-line overrides.

## First-class citizens

- **Cross-platform.** v0 ships and tests macOS only (S21). Every step still names macOS, Windows and Linux paths, so Windows and Linux are a later build-and-test step. Windows is the odd one: `resources\bin` is both the in-terminal and the global folder today (S9), and there is no PATH restore after shell startup (S10). The environment boundary must cover `.cmd` and PowerShell hook scripts as well as `sh`. Linux: `StartupWMClass` must match `executableName`, or the dock groups the window with Orca **(verify)**.
- **Remote hosts.** They work in v0 with upstream's layout on the host. Separating them is later work (S15, P3c), and v0's seams take the home folder as an argument so it stays possible.
- **Mobile.** Upstream's store app, `orca://pair`, a second host entry (P4). Mobile branding stays deferred (D52).
- **Folder workspaces.** Nothing here assumes git. The partner home (`~/.tmwk/main`) is already a folder repo (`ensure-main-home.ts:42-50`).

## Tests

Do not add tests by default ([AGENTS.md](../../AGENTS.md)). The ones worth adding fail on revert and hard-code their values:

- P2: `cli-command-inspection` on darwin classifies `/usr/local/bin/orca → /Applications/Orca.app/Contents/Resources/bin/orca` as `conflict` when the launcher is `…/tmwk.app/Contents/Resources/bin/tmwk`. Today it is `stale`, and tmwk would overwrite it.
- P3b: `toChildEnv({ ORCA_PANE_KEY: 'p', PATH: '/bin' })` is `{ TMWK_PANE_KEY: 'p', PATH: '/bin' }`. `fromInheritedEnv({ ORCA_AGENT_HOOK_PORT: '1', TMWK_PANE_KEY: 'p' })` is `{ TMWK_PANE_KEY: 'p', ORCA_PANE_KEY: 'p' }`, with the foreign port dropped.
- P3b: tmwk's matcher does not match `"${HOME-}/.orca/agent-hooks/claude-hook.sh"`, and tmwk's Claude command does not contain the text `agent-hooks/claude-hook`, which is the needle Orca searches for.
- P3b: the name-clash check (S17) fails if a `TMWK_` name equals `TMWK_` + an `ORCA_` suffix used in `src/`.
- P4: `parseSkillShareId('tmwk://skills/share/abc')` returns `abc`, and `parseSkillShareId('orca://skills/share/abc')` still does.
- P5: with the tmwk identity, the stable feed URL is `https://github.com/tmwkdev/tmwk-app/releases/latest/download`, and `wslHostsPolicyDownloadUrl('stable')` still names `stablyai/orca`.

Everything else is proved by the runbook, not by unit tests.

## Validation runbook

Run on a Mac that has `Orca.app` installed from upstream's dmg, with at least one repository, one installed plugin and one paired agent, in a user account the owner can reset. Save evidence under `docs/tmwk/side-by-side/`. Before check 1, record: `find "$HOME/Library/Application Support/orca" ~/.orca -type f -exec shasum {} + > before.txt`, `readlink /usr/local/bin/orca`, copies of `~/.claude/settings.json` and `~/.codex/hooks.json`, and `security find-generic-password -s "Orca Safe Storage"` (existence only).

| #   | Check                     | Evidence                                                                                                                                                                                                                                                                      |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Install beside Orca       | Drag `tmwk.app` to `/Applications`. Both appear in Launchpad and the Dock with their own icons (`01-dock.png`).                                                                                                                                                               |
| 2   | Run both at once          | Launch Orca, then tmwk, then the reverse. Two windows, two Dock icons, no "already running" exit (`02-both.png`, `ps` output).                                                                                                                                                |
| 3   | Separate data             | `~/Library/Application Support/tmwk` and `~/.tmwk` exist. A repository added in tmwk does not appear in Orca. Orca's installed plugin is not installed in tmwk until tmwk installs it, and then it works in both.                                                             |
| 4   | Hooks reach the right app | Start Claude in a terminal in each app. Each app shows live status for its own session only, and each hook server logs one event per hook. Repeat with Codex. The settings files hold one Orca and one tmwk entry per event (`04-hooks-*.png`, both logs, the settings diff). |
| 5   | No shared env             | In a tmwk terminal and in a Claude started there (`ps eww`), no `ORCA_*` key. Start tmwk from an Orca terminal (`/Applications/tmwk.app/Contents/MacOS/tmwk`), then repeat check 4 for that tmwk (`05-env.txt`).                                                              |
| 6   | Keychain                  | `tmwk Safe Storage` and `Orca Safe Storage` both exist. A Linear sign-in in tmwk does not change Orca's Linear state.                                                                                                                                                         |
| 7   | Commands                  | "Install command" in tmwk. `readlink /usr/local/bin/orca` is unchanged. `tmwk status` from Terminal.app and from an Orca terminal reaches tmwk. `orca status` from Terminal.app reaches Orca. `which orca` inside tmwk's terminal is tmwk's bundle (`07-cli.txt`).            |
| 8   | Links                     | `open tmwk://plugins/…` opens tmwk. `open orca://plugins/…` opens Orca. A pasted `orca://plugins/…` link previews in tmwk.                                                                                                                                                    |
| 9   | Phone                     | Pair the phone with tmwk. It lists two hosts, and both work. Mark **Not tested** without a phone.                                                                                                                                                                             |
| 10  | Remote host               | Connect one SSH host from tmwk only. A terminal there works and an agent reports to tmwk. Connecting it from both apps is not checked in v0 (S15).                                                                                                                            |
| 11  | Update                    | Install the previous tmwk release, publish the next from the Air (P5), check for updates, and it updates from `tmwkdev/tmwk-app`. Orca's "check for updates" still offers Orca's release.                                                                                     |
| 12  | Uninstall tmwk            | Uninstall tmwk from its settings. Orca's entries in the agent settings files equal the copies taken before check 1, and Orca's hooks still fire.                                                                                                                              |
| 13  | Uninstall Orca            | Reinstall tmwk, uninstall Orca. tmwk's entries are unchanged, and tmwk's hooks keep firing without a restart.                                                                                                                                                                 |
| 14  | Orca untouched            | Compare against `before.txt` and the settings copies. Only files Orca itself wrote while running differ.                                                                                                                                                                      |
| 15  | Windows and Linux         | **Not tested** for v0 (S21). Checks 1–8 on each when those platforms ship.                                                                                                                                                                                                    |
| 16  | Dev still works           | `pnpm dev` in a worktree, with both installed apps running. Dev uses `orca-dev-wt/…`, `~/.orca`, `~/.orca/agent-hooks`, `ORCA_*` and `orca-dev`, as before.                                                                                                                   |

Follow AGENTS.md for any agent-run UI check: `ORCA_BACKGROUND_LAUNCH=1`, CDP screenshots, and never `show()` a window. Checks 1, 2, 8, 11 and 13 need a real desktop and are for the owner, not an agent.

Before every push: `pnpm check:changed`, `pnpm tc`.

## Risks

- **userData might not move with `extraMetadata.name`.** P1's first spike decides. The fallback is one Extend line in preflight.
- **Late `getPath('userData')` disagrees with the early capture.** Packaged `app.setName('tmwk')` already runs post-ready (D55). With package name `orca`, a late lookup could resolve differently from the captured path (`user-data-path.ts:7,31` warns about exactly this). `extraMetadata.name: 'tmwk'` makes the two the same. If P1 finds a mismatch, `getCanonicalUserDataPath()` is the path to trust.
- **A missed boundary point leaks `ORCA_*`.** Any spawn path that skips `toChildEnv` hands Orca's scripts tmwk's routing. They would then post tmwk-pane events to tmwk a second time, or fail. Runbook check 5 and a `ps eww` sweep of every child catch it. Re-run them after each upstream sync, since upstream adds spawn paths.
- **Generated text that P3b's rewrite misses.** A hook script or plugin that still reads `ORCA_*` silently does nothing in tmwk. Check 4 covers the common agents, but not all 16.
- **Two apps write the same agent settings file.** The install locks are now separate, so a simultaneous start of both apps can race on `~/.claude/settings.json`, and one entry can be lost **(verify** whether writes re-read and merge**)**. Each app restores its own entry at its next start.
- **One-value agent settings go to whoever claims them first** (S19, accepted by the owner). With Orca's status line in place, tmwk shows no usage feed in Claude's status line.
- **Upstream web links open Orca.** `orca.dev/plugins/…` and `app.orca.dev/skills/share/…` fire `orca://`. Without Orca installed, they do nothing for a tmwk user. Pasting the link into tmwk works (S14).
- **Squirrel.Mac needs the same signing team on every release.** The first signed build cannot update itself from an ad-hoc build, which is why nothing ships before enrollment (P5).
- **One remote host from both apps (v0).** Both apps would use `~/.orca` and `~/.orca-remote` on the host, and their hook entries there would collide as described in [Agent hooks in detail](#agent-hooks-in-detail). Until P3c, connect each host from one app only. The 0.1.0 release notes say so.
- **Releases depend on one machine.** If the Air is away, asleep or its Keychain is locked, no release can ship. The certificate's `.p12` and the notary credentials need a backup the owner controls, so the homelab can take over (S20).
- **Windows unsigned, when it ships.** SmartScreen warns on every new download. An installer path that ever gains a `publisherName` locks out unsigned updates (S13).
- **Notarization scripts assume upstream's config path.** `build-mac-notarization-overlap.mjs:124` `require()`s the config by path. P5's script may need its own copy (Own) **(verify)**.
- **Upstream sync cost.** The Extend lines sit in the updater (busy), the hook installers (busiest) and many small path files. Every upstream rename of those files is a conflict. Offering the home-folder and hook-path seams upstream is the fix.

## Deferred

- **P6, `tmwk` only inside tmwk's terminals** (S10). Planned; `orca` keeps working for v0.
- **P3c, separate remote hosts and WSL** (S15). Assumed to come; v0's choices keep room for it.
- **Windows and Linux releases and testing** (S21), with the Windows signing call (S13).
- **Release automation.** A trigger for the P5 script from the local CI host's poller, if the [local CI plan](local-ci-plan.md) adds one. GitHub Actions stays off.
- **`tmwk store import <dir>`**, if moving the store becomes routine.
- **Homebrew cask** `tmwk` and a docs page. Brand plan, Deferred.
- **Dev update channels** (`tmwk-dev` releases repository). Brand plan, "Channels for tmwk".
- **A tmwk "what's new" feed** to replace the turned-off `orca.dev` nudges.
- **A tmwk plugin catalog**, if tmwk ever wants plugins Orca doesn't list.
- **A dev bundle id** (`dev.tmwk.app.dev`, `dev-electron-bundle-identity.mjs:5`). Only needed if a developer runs upstream's dev build and tmwk's at once.

Never: changing `orca://pair`, IPC/RPC names, or dev's `orca-dev` and `~/.orca` paths, and never renaming `ORCA_*` names in code. S17 renames them only on the wire, and only in packaged tmwk.

## Doc updates

- `docs/tmwk/fork-ownership.md`: the rows and patch-log lines in [Ownership changes](#ownership-changes), and S1–S22 as D-numbers in the decision log.
- `docs/tmwk/brand-plan.md`: the Side by side table's hook row becomes "decided: fully separate, see side-by-side-install-guide.md S7 and S17". Its "Never: renaming `ORCA_*` env vars" line gains "in code; packaged tmwk renames them at the process boundary (S17)". The remote-hosts row says "later, P3c" (S15). Its signing decision (owner question 5) gains: v0 is a macOS-only beta, `0.1.0`, built and published from the MacBook Air with Actions off (S20, S21). Open item 2 is closed.
- `docs/tmwk/README.md`: link this guide.

## Owner decisions

Answered by the owner on 2026-11-20 and recorded in the decisions above:

| Question                        | Answer                                                                                                 | Where                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Where tmwk's agent hooks live   | In `~/.tmwk`, not `~/.orca`. "I want these two apps to run together and have no impact on each other." | S7, P3b                                                      |
| Automatic migration of dev data | None. Hand-copying is fine                                                                             | S16, [Moving your existing data](#moving-your-existing-data) |
| One remote host from both apps  | Assume it will happen. Don't build it now, but don't make choices that block it                        | S15, P3b, later P3c                                          |
| The bundle id `dev.tmwk.app`    | Confirmed. The owner owns `tmwk.dev`                                                                   | S2                                                           |
| The first version               | `0.1.0`                                                                                                | S21, P5                                                      |
| GitHub Actions                  | Stays off (cost). Releases build on the MacBook Air or the homelab                                     | S20, P5, [local CI plan](local-ci-plan.md)                   |
| Windows and Linux               | Not tested for v0. The first release is a macOS-only beta                                              | S21, runbook check 15                                        |
| `orca` inside tmwk's terminals  | "Keep orca working for now but plan on a way to get this to be tmwk only"                              | S10, later P6                                                |
| Claude's status line            | First app to install it keeps it                                                                       | S19                                                          |
| How "beta" shows                | "Beta" in the release title for the foreseeable future. A normal GitHub release, not a prerelease      | S21, P5                                                      |

## Open questions for the owner

1. **Apple Developer enrollment (P5).** Has it completed? When it has, on the Air: create a Developer ID Application certificate and install it in the login Keychain, export a password-protected `.p12` backup to somewhere you control, and store the notarization credentials with `xcrun notarytool store-credentials tmwk-notary` (Apple ID, an app-specific password and the team id, or an App Store Connect API key). Send the team id for `ORCA_MAC_TEAM_ID_OVERRIDE`. No GitHub secrets are needed (S20). Nothing ships before this (P5).
