# Side-by-side install guide: an installable tmwk next to Orca

This guide turns the brand plan's [Side by side with Orca](brand-plan.md#side-by-side-with-orca) table and its proposed steps P0–P5 into build steps. The goal is an installable `tmwk.app` that lives beside an installed `Orca.app` on one machine, so the two share no settings, secrets, commands, links or updates by accident. The user should get the power of Orca and the simplicity of a single download. Installing tmwk should be one download and one drag. It should never break the Orca they already have, and it should never need explaining.

Written on 2026-11-19 from a read of `origin/main` at `8436bbf2af` (brand B0–B2 and D55 merged). Six read-only research passes mapped the updater, the builder config and app identity, userData and `~/.orca` paths, agent hooks, CLI install and the URL scheme. This guide was written from their findings, and the claims the plan leans on were re-read by hand. No gate was run, nothing was built and nothing was launched. Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked before anything relies on them. Line numbers drift: search for the named symbol if a line has moved.

**Done when:**

- A signed, notarized `tmwk.app` downloaded from `https://github.com/tmwkdev/tmwk-app/releases/latest` installs and runs while `Orca.app` is installed and running.
- Neither app changes the other's data, Keychain items, global command, URL scheme, update feed or agent-hook routing.
- Uninstalling either app leaves the other one working.
- tmwk updates itself from `tmwkdev/tmwk-app` and never from `stablyai/orca`.
- Source and dev runs (`pnpm dev`, `orca-dev`) behave exactly as they do today.

"Changes the other's data" has a testable meaning. After the [validation runbook](#validation-runbook), a hash of Orca's userData, Orca's `~/.orca` files (except the [shared hook files](#what-stays-shared-with-orca)), Orca's Keychain item and `/usr/local/bin/orca` is the same as before tmwk was installed and used.

## What the research changed

The brand plan's table was a first outline. The code says six things it did not:

1. **Agent hooks already route correctly between two apps** if they keep sharing the hook scripts. Each hook script reads its port, token and pane key from the agent's own environment, plus an `endpoint.env` file inside the launching app's userData (`src/main/claude/hooks/hook-script.ts:76-122`, `src/main/agent-hooks/server/server-runtime-env.ts:56-63`). Upstream built the scripts to be shared: "Parallel Orca instances must share one user-wide script path" (`src/main/agent-hooks/installation/scripts/managed-hook-script-path.ts:4`). Moving tmwk's scripts to `~/.tmwk/agent-hooks` is the **worst** option: the two apps would keep deleting each other's entries, or every event would be delivered twice ([S7](#decisions)).
2. **userData probably moves with one overlay field.** Packaged userData comes from Electron's default, `appData/<package.json name>` (`package.json:2` is `"name": "orca"`). The overlay can set `extraMetadata.name: 'tmwk'`, and that should move the folder, the single-instance lock and the updater cache with no source edit (**verify**, P1). The other part, about 12 places outside Electron that rebuild the folder path, still needs edits.
3. **The global CLI install would overwrite Orca's `orca`.** On macOS, any symlink into some `*.app/Contents/Resources/bin/<same basename>` counts as "an older copy of ours" and gets replaced (`src/main/cli/installation/cli-command-inspection.ts:132-136`). With the launcher still named `orca`, tmwk's install would take over `/usr/local/bin/orca`.
4. **The macOS CLI launcher hard-codes the executable name**: `ELECTRON="$CONTENTS/MacOS/Orca"` (`resources/darwin/bin/orca:22`). A `productName` of `tmwk` breaks the in-terminal `orca` command in P0 unless that line changes.
5. **`~/.orca` is built in about 64 files, not 30.** About 23 are desktop-host paths and about 25 are paths on remote hosts. The rest are hook-command strings that should stay as they are (S7).
6. **The release-repo constant also feeds two live data downloads.** `MAIN_RELEASE_REPO` is used by the stable and RC update feeds, and also by `wsl-hosts-policy-live-update.ts:33` and `agent-state-rules-live-update.ts:43`. Those two download upstream's policy and rules files. Pointing the constant at `tmwkdev/tmwk-app` would break them, so the app's update repo needs its own constant ([S11](#decisions)).

## Preconditions

Before P0, confirm each of these still reads as written.

| Interface                             | File                                                                                                       | What this guide does with it                                            | Re-check                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder config, a plain object export | `config/electron-builder.config.cjs:262`                                                                   | The overlay `require()`s it and overrides fields                        | Still `module.exports = {…}`, not a function. Env-dependent values are computed at load (`:104-133`), so the overlay sets env first               |
| `TMWK_PRODUCT_NAME` and its JSON twin | `src/shared/tmwk/branding/tmwk-product-name.ts`, `tmwk-product-name.json`                                  | The pattern for one shared identity file that `.cjs` can read           | The JSON is `{ "productName": "tmwk" }` and the dev bundle script reads it (`dev-electron-bundle-identity.mjs:9`)                                 |
| Packaged `appName` is `tmwk` (D55)    | `src/main/startup/profile-startup/dev-instance-identity.ts:59-71`                                          | Unchanged. P1 makes userData agree with it                              | The packaged branch sets `appName: TMWK_PRODUCT_NAME`. `app.setName` runs post-ready for packaged builds (`main-process-ready-foundation.ts:115`) |
| Early userData capture                | `src/main/persistence/loading-store/user-data-path.ts:11-15`, `getCanonicalUserDataPath`                   | P1 checks that early and late userData agree                            | `initDataPath()` still runs in preflight before `app.setName`                                                                                     |
| `configureOrcaUserDataPathEnv`        | `src/main/startup/configure-process.ts:245-259`                                                            | P3 adds the home-folder env next to it                                  | It still sets `ORCA_USER_DATA_PATH` for children                                                                                                  |
| tmwk root                             | `src/main/tmwk/main-home/main-home-paths.ts:13-24`                                                         | Packaged root is already `~/.tmwk`. P3 puts Orca's home files beside it | `TMWK_HOME`, otherwise unpackaged gives `userData/tmwk` and packaged gives `~/.tmwk`                                                              |
| Shared hook scripts                   | `managed-hook-script-path.ts:4-6`, `managed-hook-command-matching.ts:9-32`                                 | Kept shared (S7)                                                        | The name matcher still matches `agent-hooks/<stem>.{sh,cmd,ps1}` anywhere in a command                                                            |
| Child PATH shim                       | `src/main/cli/launchers/orca-cli-child-path.ts:19-80`                                                      | Keeps `orca` working inside tmwk's terminals (P2)                       | Four branches: headless, dev, packaged Linux, packaged mac/Windows                                                                                |
| Updater feed                          | `updater-setup.ts:172-175`, `updater-prerelease-feed.ts:15,20,72,78`, `updater-release-readiness.ts:4,110` | P5 points them at tmwk's repo                                           | Still the `generic` provider with URLs the app builds itself                                                                                      |

Read [`docs/agents-md-refs/cross-platform-support.md`](../agents-md-refs/cross-platform-support.md) before P1. Every step touches platform paths.

## Decisions

These are numbered S1–S16 so they don't collide with D-numbers that tickets running at the same time are taking. They take the next free D-numbers when the guide is accepted and logged in [fork-ownership.md](fork-ownership.md#decision-log). **Owner call** marks a recommendation that changes a documented surface or needs the owner to act.

| #   | Decision                                          | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Which builds get the tmwk identity.               | **Packaged builds only.** This repository never ships a packaged build with Orca's identity, so "packaged" means "tmwk". Source and dev runs keep `orca-dev` userData, `~/.orca`, `orca-dev` and `orca://`, as the brand plan requires. Code that runs inside Electron checks `isPackaged()`, as `main-home-paths.ts:19` already does. Code that runs outside Electron (the CLI, `orcad`, offline hooks) reads the env that packaged main exports (S5), and falls back to tmwk's packaged default (S4).                                                                                                                                                                                                                                                                                    |
| S2  | One identity file.                                | Own `src/shared/tmwk/app-identity/tmwk-app-identity.json` with a typed `tmwk-app-identity.ts` beside it, after the `tmwk-product-name` pattern: `appId: "dev.tmwk.app"`, `userDataDirName: "tmwk"`, `homeDirName: ".tmwk"`, `cliName: "tmwk"`, `urlScheme: "tmwk"`, `releaseRepo: "tmwkdev/tmwk-app"`, `updaterCacheDirName: "tmwk-updater"`. The builder overlay (`.cjs`) and the TypeScript both read it. Every Extend edit below reads a value from here. None of them repeats a literal.                                                                                                                                                                                                                                                                                               |
| S3  | The builder overlay.                              | Own `config/tmwk/electron-builder.tmwk.cjs`. It sets env flags, `require()`s upstream's config, and returns a copy with tmwk fields: `appId`, `productName: 'tmwk'`, `extraMetadata.name: 'tmwk'` (merged with upstream's conditional `extraMetadata`, `:267-271`), `protocols`, `win.executableName`, `linux.executableName`, `StartupWMClass`, every `artifactName`, deb/rpm `packageName`, `linux.maintainer`, the usage strings and `publish`. It must not set `win.signtoolOptions.publisherName` (S13). Upstream's file stays as it is, except the one Extend in S12.                                                                                                                                                                                                                |
| S4  | userData.                                         | `…/tmwk` on every platform, from `extraMetadata.name` (**verify** in P1 that packaged `app.getPath('userData')` returns it). Code outside Electron that rebuilds the packaged path reads `userDataDirName`: `src/cli/runtime/profile/metadata.ts:57-71`, `src/main/codex/configuration/homes/codex-home-paths.ts:74-86`, `serve-bundle-coordination.ts:48-50`, `src/main/observability/logs-directory.ts:7-19` (today it says `Orca` with a capital O), and the Command Code hook script's scan list (`command-code-managed-script.ts:26-30,117-124`), which **adds** the tmwk paths instead of replacing Orca's. The serve launchd label prefix `com.stablyai.orca.serve` (`serve-bundle-coordination.ts:6`) gets a tmwk prefix too (**verify** whether it is keyed by userData already). |
| S5  | The home folder (`~/.orca` → `~/.tmwk`).          | One home-folder function, Own `src/shared/tmwk/app-identity/app-home-dir.ts`: `appHomeDir(env = process.env)` returns `env.TMWK_APP_HOME_DIR` when it is absolute, otherwise `join(homedir(), '.orca')`. Packaged main sets `TMWK_APP_HOME_DIR` to `~/.tmwk` in preflight, next to `configureOrcaUserDataPathEnv` (one Extend line), so the CLI, the daemon and children inherit it. Each desktop-host `join(homedir(), '.orca')` becomes `appHomeDir()`, one Extend line each. Offer the function upstream as `orcaHomeDir()`. If upstream takes it, the Extend lines disappear at the next sync.                                                                                                                                                                                         |
| S6  | Orca's home files and tmwk's store in one folder. | Accept it. Packaged `~/.tmwk` already holds `main/`, `store/` and `main-session.json` (`main-home-paths.ts`). Orca's files (`keybindings.json`, `linear-*`, `*.enc`, `jira-*`, and so on) use other names, so nothing collides. P3 lists both sets in one table, so a later name clash is caught in review. One folder is the simpler mental model for the user: everything tmwk keeps in the home folder is in `~/.tmwk`.                                                                                                                                                                                                                                                                                                                                                                 |
| S7  | Agent hooks.                                      | **Keep the hook scripts and their agent-settings entries shared with Orca, under `~/.orca/agent-hooks`.** This is a stated exception to "everything under `~/.tmwk`" (brand plan, owner second round). Routing is per process. Each app's hook server has its own random token (`server-lifecycle.ts:52,67-71`) and its own `endpoint.env` in its own userData, so an event goes only to the app that launched the agent. Also shared: `managed-hook-install.lock` (`managed-hook-install-lock.ts:52-53`) and the Codex hook-trust files P3 lists. **Owner call**, because it reverses part of an owner answer. The alternative and its costs are under [Agent hooks in detail](#agent-hooks-in-detail).                                                                                   |
| S8  | Cross-app hook cleanup.                           | Teach the "another build shares these hooks" check about the other app. `orca-install-identity.ts:26` looks only for bundle id `com.stablyai.orca`. Make it accept a list: tmwk's build checks for both ids, so uninstalling tmwk keeps Orca's hooks (Extend). Orca's build won't know about `dev.tmwk.app`, so uninstalling Orca removes the shared scripts. tmwk installs them again on its next start, because startup always installs (`configure-process.ts:261-265`). Record this as a known gap. It is also a small upstream PR: "detect other builds by a list of ids".                                                                                                                                                                                                            |
| S9  | The global CLI.                                   | `tmwk`, never `orca`, for the packaged app (revisits D48 for packaged only). macOS: a second launcher, `Resources/bin/tmwk`, and `/usr/local/bin/tmwk` (or `~/.local/bin/tmwk`). Linux: `~/.local/bin/tmwk`, and the bare dispatcher is not installed by tmwk (it is serve-only, `serve-cli-registration.ts:8-59`). Windows: a separate folder, `resources\bin-global\tmwk.exe`, on the user PATH. It cannot be `resources\bin`, which is also the in-terminal `orca` folder (`cli-install-location.ts:241`, `src/main/cli/cli-installer.ts:141-150`). The global `tmwk` launcher exports `ORCA_USER_DATA_PATH` and `TMWK_APP_HOME_DIR`, so it reaches tmwk from any terminal.                                                                                                             |
| S10 | `orca` inside tmwk's terminals.                   | Keep it. The child-PATH shim already puts the app's own `bin` folder first (`orca-cli-child-path.ts:67-78`) and restores it after zsh and bash rc files (`orca-cli-shell-path.ts:1-6`). Skills, the worker preamble (`render-worker-preamble.ts`) and the partner prompt (`resources/tmwk/main-partner.md`) keep typing `orca`. The gaps (Windows has no restore; fish is **(verify)**) are risks, not P2 work.                                                                                                                                                                                                                                                                                                                                                                            |
| S11 | Where updates come from.                          | Add `APP_RELEASE_REPO` to `src/shared/updater/release-channel.ts`, read from S2's `releaseRepo` in packaged tmwk. Map stable and RC to it, and use it in the four runtime files that hard-code `stablyai/orca`. `MAIN_RELEASE_REPO` stays `stablyai/orca` for the WSL hosts policy and agent-state-rules downloads. Those are upstream's live data, not app updates. The dev channels (hourly, daily, adhoc) are hidden in packaged tmwk: their repositories don't exist (brand plan, "Channels for tmwk").                                                                                                                                                                                                                                                                                |
| S12 | Signing knobs the overlay can't reach.            | One Extend at the top of upstream's builder config: `ORCA_MAC_TEAM_ID` reads `process.env.ORCA_MAC_TEAM_ID_OVERRIDE` when it is set, and the usage strings take their product name from `process.env.ORCA_BUILDER_PRODUCT_NAME` (default `Orca`). The `afterPack` closures capture the team id and usage strings at module load (`:259`, `:903`, `:915-916`), so an overlay override does not reach the terminal-host helper. The overlay sets both env vars before its `require()`.                                                                                                                                                                                                                                                                                                       |
| S13 | Windows signing.                                  | Unsigned for now (owner, second round). The overlay leaves `publisherName` unset. `NsisUpdater.verifySignature` then skips the Authenticode check (`node_modules/electron-updater/out/NsisUpdater.js:84-99`, electron-updater 6.8.12). Never set `verifyUpdateCodeSignature: false`, and never disable it in code (`updater-setup.ts:170`). If Windows signing arrives later, the first signed release must be installed by hand: a build with a baked `publisherName` rejects every unsigned installer.                                                                                                                                                                                                                                                                                   |
| S14 | URL scheme.                                       | `tmwk://` for the desktop's two routes, `skills/share/<id>` and `plugins/<id>` (`skill-share-link.ts:15,33`, `plugin-install-link.ts:11,27-33,69`). The parsers accept both `tmwk:` and `orca:`, so a pasted Orca link still works in tmwk. tmwk never registers `orca://`. The **pairing payload stays `orca://pair?code=`** (`src/shared/remote-runtime/pairing/pairing.ts:19`), because upstream's phone app owns `orca` on the phone (`mobile/app.json:9`) and parses only that form (`mobile/src/pairing/pairing.ts:29-35`).                                                                                                                                                                                                                                                          |
| S15 | Remote hosts.                                     | P3 changes only desktop-host paths. On SSH and WSL hosts, tmwk's `orcad` keeps `~/.orca` and `~/.orca-remote` (`orcad-remote-context.ts:151,185`, `remote-install-root.ts:1`), the same as `orca-dev` uses today. **Owner call:** until a later step (deferred), connect a given remote host from only one of the two apps **(verify** whether two app versions sharing one host's data root is already supported, as upstream's stable and RC builds would need**)**.                                                                                                                                                                                                                                                                                                                     |
| S16 | Moving existing dev data.                         | **No automatic migration.** The installed tmwk starts fresh. The user copies the tmwk store and keybindings by hand before first launch (see [Moving your existing data](#moving-your-existing-data)). Profile databases, sessions, paired devices and keypairs are tied to their userData, and copying them under a new app identity would give a phone two hosts that claim the same key. **Owner call.**                                                                                                                                                                                                                                                                                                                                                                                |

## What stays shared with Orca

| Shared on purpose                                                                                                                                     | Why                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `~/.orca/agent-hooks/*` and the entries in `~/.claude/settings.json`, `~/.codex/hooks.json`, `~/.gemini/settings.json` and the other agents' settings | S7: one script per agent, routed by the launching app's env                                                                                                              |
| `~/.orca/managed-hook-install.lock`                                                                                                                   | Both apps write the same agent settings files and must not race                                                                                                          |
| Codex hook-trust state (`codex-hook-trust.json` and the trust entries in `~/.codex/config.toml`)                                                      | Follows the hook entries. P3 confirms the exact file list **(verify)**                                                                                                   |
| `~/.orca/claude-theme-sync.json`                                                                                                                      | "Every Orca build on this machine must agree" (`claude-code-theme-ownership.ts:25-26`). Two owners would fight over Claude's theme **(verify** that sharing is safe**)** |
| Agents' own homes (`~/.claude`, `~/.codex`, …) and their accounts                                                                                     | The agents' own data. Both apps launch the same agents                                                                                                                   |
| Remote hosts' `~/.orca` and `~/.orca-remote`                                                                                                          | S15, for now                                                                                                                                                             |
| `orca://pair` and upstream's relay (`relay.onorca.dev`)                                                                                               | S14 and D52. The phone sees two hosts, because each app has its own keypair in its own userData (`runtime-e2ee-keypair-file.ts:5`)                                       |

Everything else is separate: bundle id, userData, Keychain item, single-instance and profile locks, `~/.tmwk` vs `~/.orca`, the global command, the desktop URL scheme, the update feed and the updater cache.

## Agent hooks in detail

This is the check the brand plan asked for before P3 (open item 2).

**How a hook finds its app.** Every managed hook entry runs a fixed script, `"${HOME-}/.orca/agent-hooks/<agent>-hook.sh"`. The script runs only if `ORCA_PANE_KEY` or `ORCA_AGENT_PANE` is set; otherwise it drains stdin and prints `{}` (`runtime-home-hook-command.ts:27,34,49,82`; guard at `posix-hook-command.ts:10`). It then reads `ORCA_AGENT_HOOK_ENDPOINT`, a file in the launching app's userData, and posts to `127.0.0.1:$ORCA_AGENT_HOOK_PORT` with that app's token (`hook-post-command.ts:60-96`). Every PTY gets these variables from its own app (`ipc/pty/host-env/assembly.ts:130-134`), and inherited hook variables are cleared first (`spawn-env-keys.ts:8-17`). So a tmwk started from an Orca terminal never inherits Orca's routing.

**Two apps, one entry.** Both apps write the same command text. Install removes every entry the name matcher recognises and appends one (`claude/hooks/hook-settings.ts:224-260`), so there is always exactly one entry. An agent in a tmwk pane posts only to tmwk, and one in an Orca pane posts only to Orca. There is no double delivery.

**What breaks it.**

- **Shared userData.** With one userData, both apps write one `endpoint.env`. The second app to start steals the first app's events. P1 must land before any packaged tmwk runs beside Orca.
- **Script drift.** Whichever app starts last rewrites the scripts (`managed-hook-script-write.ts:24-35`, no version guard). Both apps then run that version. Keep tmwk close to upstream (regular syncs), and test hooks in both apps after each sync. Codex is protected by its frozen command forms (`codex-hook-command-form.ts:1-3`).
- **Turning hooks off in one app** removes the shared entries for both (`managed-agent-hook-controls.ts:251-272`). The other app installs them again at its next start. Sessions that are already running lose status until then.
- **Uninstall.** See S8.

**Why not `~/.tmwk/agent-hooks`.** With the same script names, each app's matcher removes the other's entry. The last installer wins, each status check reports "not installed", and Codex's trust entries in `config.toml` are rewritten at every start. With different names but the same `ORCA_*` env, both entries run and every event posts twice. A clean split needs new script stems, env names, the token header and the matcher all at once. That is a fork of the hook protocol in upstream's most-touched code (16 agent installers). It is not worth it while env routing already works.

## Build order

P0 first. P1 follows P0. P2, P3 and P4 can run in parallel after P1. P5 follows all of them. Each step is one reviewable PR. Until P1 merges, never run a packaged tmwk beside a running Orca (see [Agent hooks in detail](#agent-hooks-in-detail)), and never distribute a packaged build until P5.

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
- `resources/darwin/bin/orca:22` (Extend): read the executable from `Contents/Info.plist`'s `CFBundleExecutable` (`/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable'`) instead of the literal `Orca`. `Helpers/Orca Agents.app` (`:75-76`) and `Orca Computer Use.app` keep their names. They are internal, and their bundle ids derive from the app's (`macos-terminal-host-bundle.cjs:214,240`). **(verify** that both helpers really take the app's id, so they don't share Orca's TCC grants**)**.
- `src/main/macos-permissions/macos-tcc-prompt-watch.ts:12-17` (Extend): add `dev.tmwk.app` and `dev.tmwk.app.helper`.

Acceptance:

- `pnpm tmwk:build:mac` produces `dist/mac-arm64/tmwk.app` and `tmwk-macos-arm64.dmg`. `Info.plist` shows `CFBundleIdentifier` `dev.tmwk.app`, `CFBundleName` `tmwk`, `CFBundleURLSchemes` `tmwk`.
- `Contents/Resources/app-update.yml` names `tmwkdev` / `tmwk-app` and `updaterCacheDirName: tmwk-updater`.
- In a throwaway macOS user account with no Orca, `tmwk.app` launches (right-click → Open past Gatekeeper). Inside a tmwk terminal, `orca --help` works. This proves the launcher fix.
- `pnpm build:mac` (upstream's config) still produces an identical `Orca.app`, apart from the launcher line.

Depends on: nothing. Do not launch it beside a running Orca until P1.

### P1. userData, Keychain and the single-instance lock

Change (Extend, one value each, read from S2):

- `src/cli/runtime/profile/metadata.ts:57-71`: `orca` → `userDataDirName`. This is the packaged default only. `ORCA_USER_DATA_PATH` still wins (`:42-50`).
- `src/main/codex/configuration/homes/codex-home-paths.ts:74-86` (`getOrcaUserDataPath`): the same.
- `src/shared/remote-runtime/serve-supervisor/serve-bundle-coordination.ts:48-50`: the same. `:6` gets a tmwk label prefix (`dev.tmwk.app.serve`).
- `src/main/observability/logs-directory.ts:7-19`: `Orca` → the identity's product folder.
- `src/main/command-code/command-code-managed-script.ts:26-30,117-124`: add the `tmwk` endpoint paths to the scan. Keep Orca's.
- `src/cli/runtime/serve/supervision/serve-service-unit.ts:68-85`: the log folder `~/Library/Logs/Orca` follows the identity.

Leave alone: `configure-process.ts:234` (dev's `orca-dev`), and everything that matches `orca-dev` to detect dev mode (`coordinator-task-dispatch.ts:105`, `runtime-compatibility.ts:41`).

Spikes to answer first, and record in this guide:

- Does packaged `app.getPath('userData')` return `…/Application Support/tmwk` with `extraMetadata.name: 'tmwk'`? Does `getCanonicalUserDataPath()` (captured early) equal a late `getPath('userData')` (after `app.setName('tmwk')`)? If `extraMetadata.name` does not move it, the fallback is one Extend line in preflight: `app.setPath('userData', join(app.getPath('appData'), userDataDirName))` for packaged builds, before `configureOrcaUserDataPathEnv` (`main-process-preflight.ts:195`).
- On Windows, `windows-app-data-path.ts:53` sets `appData/<getName()>`. Confirm `getName()` is `tmwk` at that point.
- Which Keychain item does packaged tmwk create? Expected `tmwk Safe Storage`, from `CFBundleName` (`dev-instance-identity.ts:17`). Check with `security find-generic-password -s "tmwk Safe Storage"`.
- Electron's `requestSingleInstanceLock` is per userData. Confirm by running both apps. The second lock, `acquireDesktopProfileLockOrExplain(getCanonicalUserDataPath())` (`main-process-preflight.ts:252`), is keyed on userData by construction.

Acceptance:

- With Orca running, tmwk launches, and the reverse. Each shows its own window and its own repos.
- `~/Library/Application Support/tmwk` exists, and Orca's `…/orca` is unchanged (hash before and after).
- The Keychain has `tmwk Safe Storage` beside `Orca Safe Storage`.
- A Claude session in each app shows live status in its own app only (the hook routing check, runbook check 4).

Depends on: P0.

### P2. The `tmwk` command and the PATH shim

Add:

- `resources/tmwk/darwin/bin/tmwk` (Own): the macOS launcher. A copy of `resources/darwin/bin/orca` with P0's `CFBundleExecutable` lookup. It also exports `ORCA_USER_DATA_PATH="$HOME/Library/Application Support/tmwk"` and `TMWK_APP_HOME_DIR="$HOME/.tmwk"` unless they are already set. The overlay adds it to `mac.extraResources` as `bin/tmwk`. `bin/orca` stays for in-terminal use.
- `resources/tmwk/linux/bin/tmwk` (Own): the same for Linux, with XDG paths.
- `resources/tmwk/win32/bin-global/tmwk.cmd` (Own): Windows, a `.cmd` wrapper around the bundled `orca.exe` that sets both env vars (**verify** that a `.cmd` on PATH is enough for agents and shells, or whether a `tmwk.exe` copy of `native/windows-cli-launcher` is needed).

Change (Extend):

- `src/main/cli/installation/cli-install-constants.ts:1` and `cli-install-location.ts:68-74,91-95,213-245`: in packaged builds the command name and paths come from `cliName`: `/usr/local/bin/tmwk` or `~/.local/bin/tmwk` on mac, `~/.local/bin/tmwk` on Linux, and `resources\bin-global` on the Windows user PATH.
- `src/main/cli/packaged-assets/bundled-cli-launcher-path.ts:7-21`: the global launcher is `bin/tmwk` (mac, Linux) or `bin-global\tmwk.cmd` (Windows). The darwin "managed" regex (`cli-command-inspection.ts:132-136`) matches on `basename(launcherPath)`, so after this change it matches only `…/bin/tmwk`, and Orca's `/usr/local/bin/orca` becomes a conflict, never "stale". Add a test here: it fails if the revert lets tmwk reclaim a symlink into `Orca.app/Contents/Resources/bin/orca`.
- `src/renderer/src/components/settings/cli/install/CliSection.tsx:41-56`: the copy shows `status.commandName`, not a literal `orca`.
- `src/main/cli/launchers/orca-cli-child-path.ts:67-78`: packaged mac and Windows also set `ORCA_USER_DATA_PATH`, as the Linux branch does, so an in-terminal `orca` never falls back to a default path **(verify** whether `baseEnv` already carries it from `process.env`**)**.

Leave alone: the Linux bare dispatcher and its generic marker (`linux-bare-orca-dispatcher.ts:22`). tmwk never installs it outside serve. The WSL command `orca-ide` and its markers (`wsl-cli-scripts.ts:4-5,18`) are deferred: two apps registering WSL CLIs would overwrite each other's bridge.

Acceptance:

- With Orca's `/usr/local/bin/orca` installed, "Install command" in tmwk installs `/usr/local/bin/tmwk` and leaves `orca` pointing at Orca.app (`readlink` before and after).
- From a plain Terminal.app, `tmwk status` reports tmwk's runtime, and `orca status` reports Orca's.
- Inside a tmwk terminal, `which orca` is tmwk's `Resources/bin/orca`, and `orca orchestration check` reaches tmwk. The same holds after `exec zsh`.
- Windows: `tmwk` resolves in a new PowerShell. `orca` resolves to Orca's entry outside tmwk and to tmwk's inside tmwk's terminals.

Depends on: P1.

### P3. `~/.tmwk`, with hooks staying shared

Start with the inventory. Record it in this guide as a table: path, file:line, moves to `~/.tmwk` or stays shared. The research list is in [`~/.orca` sites](#orca-sites). Classify every Codex trust and theme file before moving anything.

Add:

- `src/shared/tmwk/app-identity/app-home-dir.ts` (S5, Own).

Change (Extend):

- `src/main/startup/configure-process.ts`: in packaged builds, set `process.env.TMWK_APP_HOME_DIR = join(home, homeDirName)` next to `configureOrcaUserDataPathEnv`.
- Each desktop-host site from the inventory: `join(homedir(), '.orca')` → `appHomeDir()`. At least 8 files define their own private `getOrcaDir()`. Replace the body, not the callers.
- `src/main/uninstall/orca-install-identity.ts:26,54-70` (S8): detect a list of bundle ids, `com.stablyai.orca` and `dev.tmwk.app`. Uninstall cleanup for `~/.tmwk` (`orca-uninstall-cleanup.ts:80,222-226` deletes `~/.orca` when empty) gets the same treatment for tmwk's folder.

Leave alone: `getSharedManagedScriptPath`, every hook command string (`runtime-home-hook-command.ts`, `codex-hook-command-form.ts:23`, `claude/hooks/hook-settings.ts:176`), the hook lock, and every remote-host path (S15).

Acceptance:

- After using tmwk (keybinding change, Linear sign-in, a MiniMax key), the new files are in `~/.tmwk` and Orca's `~/.orca` is unchanged, apart from the shared hook files.
- Hooks still fire in both apps (runbook check 4).
- A key sealed by Orca in `~/.orca` is never read by tmwk (tmwk has its own copy). Today the two apps would get `sealed-elsewhere` from each other (`saved-credential-readability.ts:29-77`). After P3 they never look at each other's file.
- Source and dev runs still write `~/.orca` (no `TMWK_APP_HOME_DIR` set).

Depends on: P1.

### P4. The `tmwk://` scheme

Change (Extend, values from S2):

- `src/main/startup/open-routing/orca-protocol-registration.ts:15,19,21` (Windows packaged registration): the scheme comes from the identity.
- `src/shared/skills/sharing/skill-share-link.ts:15,33` and `src/shared/plugins/catalog/plugin-install-link.ts:11,27-33,69`: accept `tmwk:` and `orca:`. `isRoutedOrcaDeepLink` (`orca-deep-link-url.ts:5-7`) then follows.
- `src/main/window/activation/macos-desktop-handoff.ts:82`: rebuild the link with the running app's scheme.
- Where tmwk builds a share link for others (`SkillsPage.tsx:172` builds `https://app.orca.dev/skills/share/<id>`): leave it. It is upstream's web page, and it opens whichever app owns `orca://`.

Leave alone: every pairing producer and parser (`pairing.ts:19,41,64`, `web-pairing.ts:46,74,184`, the CLI pairing help).

Pairing with upstream's mobile app:

- The QR code still says `orca://pair?code=…`. The phone app reads it through its own `orca` scheme. The desktop is never asked to open it.
- tmwk has its own keypair and device registry in its own userData (`host-instance-identity.ts:18-22`), so the phone lists tmwk as a second host beside Orca. The host catalog keys hosts by public key (`mobile/src/host-catalog/host-store.ts:94-104`).
- Relay pairing needs an Orca Cloud sign-in in tmwk (`relay-http-client.ts:149-165`, `login.onorca.dev`). `local-only` pairing needs none (`runtime-rpc-mobile-pairing.ts:46`).
- Moving to packaged tmwk means pairing the phone again. The dev profile's pairing does not carry over (S16).

Acceptance:

- `open 'tmwk://plugins/<id>?catalog=official'` opens tmwk's plugin preview, and `open 'orca://plugins/<id>…'` opens Orca's.
- A phone already paired with Orca pairs with tmwk too and lists two hosts. Mark **Not tested** without a phone.

Depends on: P1.

### P5. Updates, signing and the public release

Change (Extend):

- `src/shared/updater/release-channel.ts:22-38` (S11): add `APP_RELEASE_REPO`, `tmwkdev/tmwk-app` in packaged tmwk. Map stable and RC to it. Hide the dev channels (`:51-55`) in packaged tmwk **(verify** that the build picker and settings handle an empty dev-channel list**)**.
- `src/main/updater/lifecycle/updater-setup.ts:172-175`, `updater-prerelease-feed.ts:15,20,72,78` and `updater-release-readiness.ts:4,110`: build their URLs and regexes from `APP_RELEASE_REPO`.
- Release-notes links (`getReleaseNotesUrlForVersion`, `release-channel.ts:178-184`) follow, since they read the channel's repo.
- The nudge and changelog URLs (`nudge-campaign.ts:12`, `updater-changelog.ts:13,32`, all `orca.dev`) are turned off in packaged tmwk. Today they would show Orca's "what's new" inside tmwk.

Add (Own):

- `.github/workflows/tmwk-release-mac.yml`: on a `v*` tag in `tmwkdev/tmwk-app`, build arm64 and x64 with the overlay. Set `ORCA_MAC_RELEASE=1` (hardened runtime, notarization, `forceCodeSigning`), `ORCA_MAC_TEAM_ID_OVERRIDE` and the secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` (the names `release-mac-build.yml:135-139` uses). Publish to a draft release. **(verify** that `config/scripts/desktop-distribution/macos/sign-mac-app.mjs` and `build-mac-notarization-overlap.mjs:124` work with an overlay config path; the second `require()`s upstream's config by path**)**.
- `.github/workflows/tmwk-release-win.yml` and `tmwk-release-linux.yml`: unsigned NSIS, AppImage and deb, uploaded to the same draft.
- A "Releasing" section added to this guide: bump `version`, tag, wait for the three workflows, check the draft has every asset, publish.

Leave alone: upstream's release workflows. They stay guarded to `stablyai/orca` (`release-cut.yml:49`, `release-mac-build.yml:49`, and the others). `release-mirror-r2.yml`, `release-javascript.yml` and `homebrew-bump.yml` have no guard. Disable them in `tmwkdev/tmwk-app`'s Actions settings, or add the guard (Extend) **(verify** whether they trigger on tags here**)**.

Version line: tmwk starts at `0.1.0`, separate from upstream's `1.4.x` (`package.json:3`). The updater compares versions with its own parser (`app-version.ts:6-19,61-95`) and electron-updater's `semver`, and allows no downgrade (`updater-setup.ts:151`). `0.1.0` < `1.4.214` only matters if a tmwk build ever reads Orca's feed, which P5 prevents. **(verify** that nothing else compares the app version with upstream's, such as the `orcad` compatibility contract, `local-build-compatibility-contract.ts`**)**.

Acceptance:

- A tag produces a draft release with `latest-mac.yml`, `latest.yml`, `latest-linux.yml`, the zips and blockmaps, the dmgs, the exe and the AppImage.
- `spctl -a -vv tmwk.app` says "Notarized Developer ID". `xcrun stapler validate` passes.
- Install `0.1.0` from the dmg, publish `0.1.1`, and `0.1.0` updates itself. Proxy logs show requests only to `github.com/tmwkdev/tmwk-app`.
- Windows `0.1.0` updates to `0.1.1` unsigned, with SmartScreen's warning only at first install.

Depends on: P0–P4, and the owner's Apple Developer enrollment (open question 1). Until enrollment completes, ship macOS as manual downloads. Squirrel.Mac refuses updates for an ad-hoc-signed app.

## Moving your existing data

Today the user's tmwk data lives in three places on the laptop:

| Where                                                                                      | What                                                                                                                                                                                                    | Moves to the installed tmwk?                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `~/Library/Application Support/orca-dev` (and `orca-dev-wt/<…>` for per-worktree dev runs) | Orca profile state (`orca-data.json`, `profiles/`, `orchestration.db`), sessions, paired devices, the E2EE keypair, `agent-hooks/endpoint.env`, and the dev **tmwk root**, `tmwk/` (no `TMWK_HOME` set) | **Only `tmwk/store/records.json` and `tmwk/store/summary.json`, by hand.** The rest starts fresh |
| `~/.orca`                                                                                  | Keybindings, integration credentials sealed with the `tmwk Dev` Keychain item (Linear, Jira, MiniMax, Z.ai, …), the shared hook scripts                                                                 | **`keybindings.json`, by hand.** Credentials are entered again. The hook scripts stay shared     |
| `TMWK_HOME`, if the user set one                                                           | Same layout as the dev tmwk root                                                                                                                                                                        | Same as the first row                                                                            |

Why only those files:

- **`records.json`** holds preferences, notes and briefs. It is the memory the user built, and it has a versioned format with no references to a profile (`tmwk-record-store.ts:58`).
- **`summary.json`** holds working summaries. They are text. Their `sessionId` fields point at old sessions and are only history.
- **`tickets.json`** and **`presence.json`** are not carried over. Ticket snapshots are keyed by Orca task ids in the old profile's `orchestration.db`, and presence is per-run.
- **`main-session.json`** is not carried over. It pins a session in the old profile. The installed app creates its own main session and partner home (`ensure-main-home.ts:26-50`).
- **Profile databases, the keypair and the device registry** are tied to their userData and Keychain item. Copied, they would decrypt nothing (new Keychain item) and make a phone see one key twice.

What the user does by hand, once, before the first launch of the installed tmwk:

```sh
# Quit every dev run first.
SRC="$HOME/Library/Application Support/orca-dev/tmwk"   # or $TMWK_HOME
mkdir -p ~/.tmwk/store && chmod 700 ~/.tmwk ~/.tmwk/store
cp "$SRC/store/records.json" "$SRC/store/summary.json" ~/.tmwk/store/
chmod 600 ~/.tmwk/store/*.json
cp ~/.orca/keybindings.json ~/.tmwk/keybindings.json   # after P3 ships
```

Then, in the installed tmwk: add the repositories again, sign in to Orca Cloud if relay pairing is wanted, pair the phone, enter integration keys (Linear, Jira, MiniMax, Z.ai, and the others), and click "Install command" for `tmwk`. Agent accounts (Claude, Codex) need nothing: they live in the agents' own homes. If the tmwk home host is a remote host, the store lives on that host, and none of this applies to it.

Dev data stays where it is. Source and dev runs keep using it, so the user can run `pnpm dev` and the installed tmwk side by side. They do not share a store, and a preference set in one does not show in the other. A later step can add `tmwk store import <dir>` if moving the store becomes routine (deferred).

## `~/.orca` sites

The research list for P3's inventory, desktop host only. "Stays" means S7.

| Path under the home folder                                                                | Where it is built                                                                             | P3                                                               |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `keybindings.json`                                                                        | `src/main/keybindings/keybinding-file.ts:29`                                                  | Moves                                                            |
| `linear-token.enc`, `linear-viewer.json`, `linear-workspaces.json`, `linear-tokens/`      | `src/main/linear/accounts/linear-credential-paths.ts:7-25`                                    | Moves                                                            |
| `minimax-session-cookie.enc`                                                              | `src/main/minimax/minimax-cookie-store.ts:18-23`                                              | Moves                                                            |
| `minimax-api-key.enc`, `openai-compatible-speech-provider.enc`, `opencode-go-api-key.enc` | `src/main/credentials/encrypted-api-key-file-store.ts:42-48`                                  | Moves                                                            |
| `zcode-plan-api-key.enc`                                                                  | `src/main/zcode/zcode-plan-api-key-store.ts:18-19`                                            | Moves                                                            |
| `openai-speech-token.enc`                                                                 | `src/main/speech/openai-api-key-store.ts:18-19`                                               | Moves                                                            |
| `jira-sites.json`, `jira-tokens/`                                                         | `src/main/jira/site-credential-store.ts:30-40`                                                | Moves                                                            |
| `bitbucket-credential.json`                                                               | `src/main/bitbucket/credential-store.ts:48-53`                                                | Moves                                                            |
| `orcad` credential root and sealing keys                                                  | `src/main/orcad/credentials/orcad-plaintext-credential-migration.ts:49-51`                    | Moves **(verify** with `orcad-secret-store-startup.ts:9-10`**)** |
| `claude-agent-teams-bin/`                                                                 | `src/main/runtime/terminal/launch/claude-agent-teams-shim-env.ts:104-105`                     | Moves                                                            |
| `host-settings/<key>/terminals.json`                                                      | `src/main/daemon/admission/host-terminal-policy.ts:27`                                        | Moves                                                            |
| `claude-theme-sync.json`                                                                  | `src/main/claude/theme-sync/claude-code-theme-ownership.ts:25-26`                             | Stays **(verify)**                                               |
| `agent-hooks/*`, `agent-hooks/grok-owners/`                                               | `managed-hook-script-path.ts:4-6`, `jcode/hook-settings.ts:40`, `grok/grok-hook-owners.ts:13` | Stays                                                            |
| `managed-hook-install.lock`                                                               | `managed-hook-install-lock.ts:52-53`                                                          | Stays                                                            |
| Codex hook-trust files                                                                    | `codex/trust/hooks/codex-hook-trust-cleanup.ts:184` and neighbours                            | Stays **(verify** the list**)**                                  |

The research counted about 64 non-test files that build a `~/.orca` path. About 23 are the desktop sites above and about 25 are remote-host paths (S15). P3's inventory must account for every one of them. Project-local `.orca/` folders (plugin `types`, `shots`, `drops`, browser downloads) are a different thing and stay.

## Ownership changes

- New Own rows: `config/tmwk/**` (the overlay and its scripts), `src/shared/tmwk/app-identity/**` (covered by `src/shared/tmwk/**`, but list it), `resources/tmwk/darwin/**`, `resources/tmwk/linux/**`, `resources/tmwk/win32/**` (covered by `resources/tmwk/**`), `.github/workflows/tmwk-release-*.yml`.
- New Extend rows, each with a patch-log line: `config/electron-builder.config.cjs` (S12), `resources/darwin/bin/orca`, `macos-tcc-prompt-watch.ts`, the P1 path files, the P2 CLI install files and `orca-cli-child-path.ts`, `configure-process.ts` and each P3 site, `orca-install-identity.ts`, the P4 link parsers and `orca-protocol-registration.ts`, and the P5 updater files.
- Expected Extend size: about 6 lines in P1, about 8 in P2, 1 plus about 20 one-line edits in P3, about 6 in P4 and about 10 in P5. P3 is the largest. It shrinks to almost nothing if upstream takes `orcaHomeDir()`.

## First-class citizens

- **Cross-platform.** Every step names macOS, Windows and Linux paths. Windows is the odd one: `resources\bin` is both the in-terminal and the global folder today (S9), and there is no PATH restore after shell startup (S10). Linux: `StartupWMClass` must match `executableName`, or the dock groups the window with Orca **(verify)**.
- **Remote hosts.** tmwk's `orcad` on a remote host keeps upstream's layout (S15). Its CLI on the host stays `~/.orca/cli/bin/orca`, so agents there type `orca`, as they do today.
- **Mobile.** Upstream's store app, `orca://pair`, a second host entry (P4). Mobile branding stays deferred (D52).
- **Folder workspaces.** Nothing here assumes git. The partner home (`~/.tmwk/main`) is already a folder repo (`ensure-main-home.ts:42-50`).

## Tests

Do not add tests by default ([AGENTS.md](../../AGENTS.md)). The ones worth adding fail on revert and hard-code their values:

- P2: `cli-command-inspection` on darwin classifies `/usr/local/bin/orca → /Applications/Orca.app/Contents/Resources/bin/orca` as `conflict` when the launcher is `…/tmwk.app/Contents/Resources/bin/tmwk`. Today it is `stale`, and tmwk would overwrite it.
- P4: `parseSkillShareId('tmwk://skills/share/abc')` returns `abc`, and `parseSkillShareId('orca://skills/share/abc')` still does.
- P5: with the tmwk identity, the stable feed URL is `https://github.com/tmwkdev/tmwk-app/releases/latest/download`, and `wslHostsPolicyDownloadUrl('stable')` still names `stablyai/orca`.

Everything else is proved by the runbook, not by unit tests.

## Validation runbook

Run on a Mac that has `Orca.app` installed from upstream's dmg, with at least one repository and one paired agent, in a user account the owner can reset. Save evidence under `docs/tmwk/side-by-side/`. Before check 1, record hashes: `find "$HOME/Library/Application Support/orca" ~/.orca -type f -not -path '*/agent-hooks/*' -exec shasum {} + > before.txt`, `readlink /usr/local/bin/orca`, and `security find-generic-password -s "Orca Safe Storage"` (existence only).

| #   | Check                     | Evidence                                                                                                                                                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Install beside Orca       | Drag `tmwk.app` to `/Applications`. Both appear in Launchpad and the Dock with their own icons (`01-dock.png`).                                                                                                     |
| 2   | Run both at once          | Launch Orca, then tmwk, then the reverse. Two windows, two Dock icons, no "already running" exit (`02-both.png`, `ps` output).                                                                                      |
| 3   | Separate data             | `~/Library/Application Support/tmwk` and `~/.tmwk` exist. A repository added in tmwk does not appear in Orca.                                                                                                       |
| 4   | Hooks reach the right app | Start Claude in a terminal in each app. Each app shows live status for its own session only. Repeat with Codex (`04-hooks-*.png`, both apps' hook server logs).                                                     |
| 5   | Keychain                  | `tmwk Safe Storage` and `Orca Safe Storage` both exist. A Linear sign-in in tmwk does not change Orca's Linear state.                                                                                               |
| 6   | Commands                  | "Install command" in tmwk. `readlink /usr/local/bin/orca` is unchanged. `tmwk status` and `orca status` from Terminal.app reach their own app. `which orca` inside tmwk's terminal is tmwk's bundle (`06-cli.txt`). |
| 7   | Links                     | `open tmwk://plugins/…` opens tmwk. `open orca://plugins/…` opens Orca.                                                                                                                                             |
| 8   | Phone                     | Pair the phone with tmwk. It lists two hosts, and both work. Mark **Not tested** without a phone.                                                                                                                   |
| 9   | Update                    | Install the previous tmwk release, check for updates, and it updates from `tmwkdev/tmwk-app`. Orca's "check for updates" still offers Orca's release.                                                               |
| 10  | Uninstall tmwk            | Uninstall tmwk from its settings. Orca's hooks still fire (check 4 in Orca only), and `/usr/local/bin/orca` still works.                                                                                            |
| 11  | Uninstall Orca            | Reinstall tmwk, uninstall Orca. tmwk's hooks come back at its next launch (S8's known gap). Record how long status was missing.                                                                                     |
| 12  | Orca untouched            | Compare against `before.txt`. Only files Orca itself wrote while running differ.                                                                                                                                    |
| 13  | Windows and Linux         | Checks 1–7 on each. Mark **Not tested** where no machine is available.                                                                                                                                              |
| 14  | Dev still works           | `pnpm dev` in a worktree, with both installed apps running. Dev uses `orca-dev-wt/…`, `~/.orca` and `orca-dev`, as before.                                                                                          |

Follow AGENTS.md for any agent-run UI check: `ORCA_BACKGROUND_LAUNCH=1`, CDP screenshots, and never `show()` a window. Checks 1, 2, 7, 9 and 11 need a real desktop and are for the owner, not an agent.

Before every push: `pnpm check:changed`, `pnpm tc`.

## Risks

- **userData might not move with `extraMetadata.name`.** P1's first spike decides. The fallback is one Extend line in preflight.
- **Late `getPath('userData')` disagrees with the early capture.** Packaged `app.setName('tmwk')` already runs post-ready (D55). With package name `orca`, a late lookup could resolve differently from the captured path (`user-data-path.ts:7,31` warns about exactly this). `extraMetadata.name: 'tmwk'` makes the two the same. If P1 finds a mismatch, `getCanonicalUserDataPath()` is the path to trust.
- **Hook script drift.** The two apps run whichever script the last one wrote. A tmwk far behind upstream could break Orca's hooks, or the reverse. Sync often, and run check 4 after every upstream sync.
- **"Turn off hooks" in one app turns them off for both** until the other restarts. Document it in tmwk's settings copy **(verify** the setting's copy**)**.
- **Upstream web links open Orca.** `orca.dev/plugins/…` and `app.orca.dev/skills/share/…` fire `orca://`. Without Orca installed, they do nothing for a tmwk user. Pasting the link into tmwk works (S14).
- **Squirrel.Mac needs the same signing team on every release.** The first signed build cannot update itself from an ad-hoc build. Until enrollment, every macOS install is a manual download.
- **Windows unsigned.** SmartScreen warns on every new download. An installer path that ever gains a `publisherName` locks out unsigned updates (S13).
- **Notarization scripts assume upstream's config path.** `build-mac-notarization-overlap.mjs:124` `require()`s the config by path. P5's workflow may need its own copy (Own) **(verify)**.
- **Remote hosts are shared.** Two apps that connect the same SSH host share its `~/.orca` data root (S15).
- **Upstream sync cost.** The Extend lines sit in the updater (busy) and the CLI install code (quiet). P3's ~20 one-line edits are spread over many files, and each upstream rename of those files is a conflict. Offering `orcaHomeDir()` upstream is the fix.

## Deferred

- **Remote data root** for tmwk on SSH and WSL hosts (`~/.tmwk-remote`, about 25 sites), so both apps can use one host (S15).
- **WSL CLI registration** under `tmwk`, with app-specific markers (`wsl-cli-scripts.ts:4-5,18`).
- **`tmwk store import <dir>`**, if moving the store becomes routine.
- **Homebrew cask** `tmwk` and a docs page. Brand plan, Deferred.
- **Windows signing.** Owner, later.
- **Dev update channels** (`tmwk-dev` releases repository). Brand plan, "Channels for tmwk".
- **A tmwk "what's new" feed** to replace the turned-off `orca.dev` nudges.
- **A dev bundle id** (`dev.tmwk.app.dev`, `dev-electron-bundle-identity.mjs:5`). Only needed if a developer runs upstream's dev build and tmwk's at once.

Never: changing `orca://pair`, the `ORCA_*` env names, IPC/RPC names, the hook command strings, or dev's `orca-dev` paths.

## Doc updates

- `docs/tmwk/fork-ownership.md`: the rows and patch-log lines in [Ownership changes](#ownership-changes), and S1–S16 as D-numbers in the decision log.
- `docs/tmwk/brand-plan.md`: the Side by side table's hook row becomes "decided: shared, see side-by-side-install-guide.md S7". The `~/.orca` row notes the hook exception. Open item 2 is closed.
- `docs/tmwk/README.md`: link this guide.

## Open questions for the owner

1. **Apple Developer enrollment (P5).** When it completes: create a Developer ID Application certificate, export it as a `.p12` with a password, and create an app-specific password for the Apple ID. Add five repository secrets to `tmwkdev/tmwk-app`: `CSC_LINK` (the base64 `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. Send the team id for `ORCA_MAC_TEAM_ID_OVERRIDE`. Or choose an App Store Connect API key for notarization instead of the Apple ID.
2. **S7, hooks stay in `~/.orca/agent-hooks`.** This reverses part of the second-round answer "tmwk things should live under ~/.tmwk". Confirm the exception.
3. **S16, no automatic migration.** Confirm that copying `records.json`, `summary.json` and `keybindings.json` by hand, and re-entering credentials, is acceptable. The alternative is a `tmwk store import` command before the first release.
4. **S15, one app per remote host for now.** Is the MBP (or any host) going to be connected from both Orca and tmwk? If yes, the remote data root moves up from Deferred.
5. **The bundle id `dev.tmwk.app`.** The brand plan took it from grenada. It is permanent once a signed build ships: Keychain items, TCC grants and updates are keyed on it. Confirm it.
6. **The first version number.** `0.1.0`, or tmwk's own `1.0.0`?
7. **The `tmwkdev/tmwk-app` Actions settings.** Allow the tmwk release workflows to create releases (`contents: write`). Turn off upstream's unguarded workflows (`release-mirror-r2.yml`, `release-javascript.yml`, `homebrew-bump.yml`), or approve guarding them (Extend).
8. **A Windows and a Linux machine for runbook check 13**, or accept **Not tested** for the first release.
