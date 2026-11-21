# Identity and egress guide: one tmwk seam for who the app is and where it talks

This guide adds a new ownership boundary to [fork-ownership.md](fork-ownership.md). **Identity and egress** covers everything about who the app is and where it sends data or pulls updates from. tmwk owns it through one config seam, instead of one-off patches in upstream (Track) code. It also covers a tripwire that catches new upstream references before they ship, and how this reshapes the [side-by-side install guide](side-by-side-install-guide.md) (P0–P5) and the [telemetry plan](telemetry-plan.md) stages.

Status: decided (2026-11-20). The owner answered the open questions; see [Owner decisions](#owner-decisions). Nothing is left open.

Written on 2026-11-20 from a read of `origin/main` at `6e5d21b968` (brand B0–B6, D55, the license and footer, and the logo mark merged). It also reads three open branches: `tykowale/telemetry-v0-patch` at `bf3c25c352` (the telemetry v0 patch, in progress), `tykowale/telemetry-investigation` (PR #53) and `tykowale/local-ci-nightly` (PR #54). Five read-only research passes mapped the updater and release code, telemetry, diagnostics and feedback, data paths and agent hooks, the CLI name and URL scheme, and the merged tmwk patches. This guide was written from their findings, and the claims the plan leans on were re-read by hand. No gate was run and nothing was built. Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked before anything relies on them. Line numbers drift: search for the named symbol if a line has moved.

**Why now (owner, 2026-11-20):** "This is a sign to me that we really need to reconsider some of the ownership boundaries so we aren't constantly going to be running into merge conflicts or at risk of them introducing new configs that we suddenly get caught flat footed on."

The values that keep causing problems cut across the domain split. Each one has been found on its own so far:

- the update feed and release repo
- the team id and publish config
- the `orca.dev` feedback endpoint and the PostHog host
- the diagnostics and analytics build constants
- data folders
- agent hooks
- the CLI name, the `orca://` scheme, and `appName` and the Keychain name

Upstream lands more than 6,000 commits a month. Any of them can add another value like these.

**Done when:**

- Every value that names the app (to the OS, the user's file system or the shell) or names a remote host, key or repo, is read from one Own module, `src/shared/tmwk/identity/`. No Track or Extend file holds a tmwk value or a live Orca endpoint as a literal. The only exceptions are listed in the tripwire baseline, each with a reason.
- The migrated one-off patches (brand B0–B6, D55, the telemetry v0 patch) read their values from that module, and their Extend lines do not grow.
- On every upstream sync and every night, a script reports new `orca.dev`/`stablyai` references, new outbound hosts, new `ORCA_*` env names, new build constants and new `~/.orca` paths in upstream's changes. Each night with hits opens one tmwk ticket.
- A packaged tmwk sends nothing to an Orca endpoint it has not chosen to use. "Chosen" means the value is in the seam with a reason, and the runbook's proxy check confirms it.

The product goal is the same as for the rest of tmwk: keep Orca's power, and make it simple to live with. Here, "simple" means one place to look. The questions "where does this app talk to?" and "what is it called on disk?" have their answer in one file, and a new upstream value shows up as a ticket rather than a surprise.

## What the research changed

1. **The telemetry v0 patch already started the seam.** It created `src/shared/tmwk/identity/tmwk-egress.ts` (`TMWK_EGRESS = { feedback: { apiUrl: null, issueRepo }, diagnostics: { blockedHosts } }`). Upstream files read it through small Extend lines (`feedback-request.ts`, `feedback.ts`, `diagnostic-upload-endpoint.ts`). This guide adopts that folder and that pattern, and does not start a second one. The side-by-side guide's S2 had proposed `src/shared/tmwk/app-identity/`; that path is dropped (E1).
2. **The domain map can't express these values.** The updater, telemetry, hooks and CLI install code are all Orca's domain and Track. But the _values_ in them (which repo, which host, which folder, which command) are tmwk's in a packaged tmwk. So far each value has been found during some other task and patched on its own. 14 of the 37 Extend patch-log entries exist only to change identity or egress values (brand B1–B3, B6, B7b, D55, footer, license). With the open B7 PR and the telemetry patch, that becomes 16 of 39.
3. **Upstream often has a chokepoint, and some of its own code skips it.** `getReleaseRepoForChannel` (`src/shared/updater/release-channel.ts:86-88`) is the updater's chokepoint. Even so, four updater files hard-code `stablyai/orca` in seven places (`updater-setup.ts:174`, `updater-prerelease-feed.ts:15,20,72,78`, `updater-release-readiness.ts:4,110`). The hook script path has a seam (`getSharedManagedScriptPath`, 15 callers), but `jcode/hook-settings.ts:40`, `grok/grok-hook-owners.ts:13` and all 16 remote installers bypass it. Where a chokepoint exists, routing through it is one patch, not seven.
4. **`MAIN_RELEASE_REPO` holds two different values.** One is where tmwk gets _app updates_ (must be tmwk). The other is where it gets _upstream's public data_: `agent-state-rules-live-update.ts:43` and `wsl-hosts-policy-live-update.ts:33` (stay `stablyai/orca`). The seam keeps these as two keys (E5).
5. **Some hosts can be overridden by env, but only in unpackaged builds.** Cloud auth, relay, push, connector and artifacts take `ORCA_CLOUD_*`, `ORCA_RELAY_URL` and similar overrides that `profile-cloud-auth-config.ts:30-44` ignores when `app.isPackaged`. Others have no override at all: feedback, nudge, changelog, kill list, install stats, the PostHog host and the updater URLs. A packaged release always uses the literal, so env can't be the seam for packaged tmwk.
6. **There was no `upstream` remote.** The only remote was `origin`, and the sync process in fork-ownership.md existed only in docs. The tripwire needs `upstream/main` to scan a sync before it merges. The partner has since added it to the agents' clone (see [Preconditions](#preconditions)).

## Preconditions

Before I0, confirm each of these still reads as written.

| Precondition                                                                                                       | State (2026-11-20)                                                                                                                                                     | Who            |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `upstream` remote on the agents' clone, `~/tmwk-ssh-target/tmwk-app` (its worktrees share it)                      | **Done** by the partner: `upstream` = `https://github.com/stablyai/orca.git`, push URL `DISABLED`. Check with `git remote -v`                                          | —              |
| `upstream` remote on the nightly mirror, `~/ci/tmwk-app.git`                                                       | The mirror doesn't exist yet. The local CI owner adds the same remote, push `DISABLED`, when it creates the mirror (PR #54). I2's nightly step and noise spike need it | Local CI owner |
| The telemetry v0 patch (`tykowale/telemetry-v0-patch`)                                                             | In progress, behind main; needs a rebase. I1 covers either merge order                                                                                                 | Its ticket     |
| The nightly runner (`config/tmwk/local-ci/nightly.sh`, PR #54)                                                     | Draft. I2 adds a step and a second ticket state file to it                                                                                                             | Local CI owner |
| `release-channel.ts` is still the updater's chokepoint, and the four updater files still hard-code `stablyai/orca` | As in the [Inventory](#inventory)                                                                                                                                      | I3             |
| `installElectronProxyRequestGuard` is still the default session's only `onBeforeRequest` listener                  | `src/main/network/electron-proxy-request-guard.ts:5-15`                                                                                                                | I4             |

## Inventory

Counts are `git grep -l` file counts on `origin/main` at `6e5d21b968`. "Non-test" excludes `*.test.*`, `*.spec.*`, `__tests__/`, `tests/` and fixtures. The **Route** column is where each reference ends up:

- **seam**: an Extend reads the identity module.
- **build**: the builder overlay or release script sets it, with no source edit.
- **fine**: it stays as it is. The reason is recorded in the tripwire baseline.
- **later**: deferred to the step named.

### Totals

| Pattern                          | Files (repo) | Non-test (repo) | Files in `src/` | Non-test in `src/` |
| -------------------------------- | -----------: | --------------: | --------------: | -----------------: |
| `orca.dev`                       |          126 |              95 |              56 |                 39 |
| `onorca.dev`                     |           51 |              21 |              24 |                  8 |
| `stablyai`                       |          586 |             188 |             118 |                 58 |
| `com.stablyai` (bundle/label id) |           40 |              26 |              23 |                 11 |
| `orca://`                        |           68 |              57 |              42 |                 34 |
| `posthog.com`                    |            2 |               2 |               1 |                  1 |
| `MAIN_RELEASE_REPO`              |            4 |               4 |               3 |                  3 |
| `.orca` path segments            |          174 |             116 |             147 |       90 (strict)¹ |
| `ORCA_[A-Z0-9_]+`                |        2,113 |           1,566 |           1,455 |              1,046 |

¹ Of the 90, about 50 build a home-folder path: 14 desktop data files, about 15 remote-host and WSL, and about 22 hook paths and command strings. The rest are project-local `.orca/` folders inside a user's repository (`workspace-hooks/issue-command-file.ts:16`, `drop-staging-ignore.ts:2`, plugin authoring under `src/cli/plugins/`), and are fine.

About 720 distinct `ORCA_*` names appear in non-test `src/`. About 236 are read with `process.env.ORCA_*`, and roughly 290 once injected `env.ORCA_*` objects are counted. Six to eight are build-time `define`s (`electron.vite.config.ts:237-243`, `vite.web.config.ts:27-28`). The rest are code constants (`ORCA_HOOK_PROTOCOL_VERSION`, …) and need no action. The side-by-side guide's S17 handles env at the process boundary, so names are never renamed in code.

Where the 95 non-test `orca.dev` files are:

| Area                      | Count | Route                                                                     |
| ------------------------- | ----: | ------------------------------------------------------------------------- |
| `src/main`                |    11 | 8 egress sites (seam), the rest comments and links                        |
| `src/renderer`            |    21 | docs links (fine, decided: leave them)                                    |
| `src/shared`              |     6 | the share-link host allowlist (later, P4); feature-wall docs links (fine) |
| `mobile/`                 |    11 | not shipped (fine)                                                        |
| `.github/`                |    10 | Actions is off (fine)                                                     |
| `docs/`                   |    23 | upstream docs (fine)                                                      |
| `config/scripts`          |     2 | upstream release scripts (fine)                                           |
| `cloud/`, `Casks/`, other |    11 | fine                                                                      |

`stablyai` in non-test `src/` (58 files) is mostly links and plugin-publisher identity. Only the updater, the data downloads and the bundle and label ids are egress or identity.

### Egress: what the app sends or fetches

| What                                                 | Where                                                                                                                                                     | Today                                                                                    | Route                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Feedback, crash and language-request forms           | `src/main/ipc/feedback/feedback-request.ts:9` (`FEEDBACK_API_URL`), callers in `feedback.ts:58,94,118,153,199`                                            | `https://orca.dev/v1/feedback`, no gate                                                  | **seam**: the telemetry v0 patch (I1 absorbs it)                                |
| Diagnostics upload                                   | `src/main/observability/diagnostic-upload-endpoint.ts:19-30`, `diagnostic-bundle-upload.ts:40,63,122`                                                     | Build constant `ORCA_DIAGNOSTICS_TOKEN_URL`, or a runtime env when the identity is unset | **build** (never set) plus **seam** (`blockedHosts`, the v0 patch)              |
| PostHog analytics                                    | `src/main/telemetry/client.ts:24-38` (gates), `posthog-transport.ts:82` (`host: 'https://us.i.posthog.com'`)                                              | Off unless identity and write key are baked in                                           | **build** (write key, identity) plus **seam** (host, I3)                        |
| App update feed                                      | `updater-setup.ts:171-175`, `updater-prerelease-feed.ts:15,20,72,78`, `updater-release-readiness.ts:4,7-27,110`, `release-channel.ts:22-38,86-88,178-184` | `stablyai/orca` and the three dev-channel repos                                          | **seam**: `release.appRepo` (I3)                                                |
| Release builds picker                                | `updater-release-builds.ts:26,98,149-161,208` (through `getReleaseRepoForChannel`)                                                                        | Channel repos                                                                            | **seam**, follows `release-channel.ts`                                          |
| Upstream public data                                 | `agent-state-rules-live-update.ts:43`, `wsl-hosts-policy-live-update.ts:33`, `plugin-json-schema.ts:19`                                                   | `stablyai/orca` release assets and raw files                                             | **seam**: `release.upstreamDataRepo` stays `stablyai/orca` (E5)                 |
| What's-new changelog, update nudge                   | `updater-changelog.ts:13,32`, `nudge-campaign.ts:12`                                                                                                      | `orca.dev/whats-new/*.json`                                                              | **seam**: `whatsNew.*` null, so off (I3; side-by-side P5 already planned it)    |
| Plugin kill list, install stats                      | `plugin-kill-list-service.ts:11`, `plugin-install-stats-service.ts:10`                                                                                    | `orca.dev/plugins/*.json`                                                                | **seam**. Kill list: keep reading (decided). Install stats: keep (decided, E16) |
| Plugin catalogs                                      | `plugin-marketplace.ts:21,23,228`, `plugin-install-link.ts:15`                                                                                            | `github.com/stablyai/orca-plugins`, `…-community-plugins`                                | **fine**: S18 says Orca plugins work in tmwk                                    |
| Orca Cloud (sign-in, relay, push, share, connectors) | `profile-cloud-auth-config.ts:25-27`, `artifact-cloud-config.ts:3,21-28`, `connector-origin.ts:5`, `push-gateway-origin.ts:4`, `skill-share-link.ts:2`    | `*.onorca.dev`, used only after the user signs in                                        | **fine** for v0. **Planned removal** in I5 (decided, E15)                       |
| Mobile diagnostics                                   | `mobile/src/diagnostics/connection-diagnostics-submission.ts:3`                                                                                           | `orca.dev/v1/feedback`                                                                   | **fine**: tmwk doesn't ship the phone app                                       |
| Third parties                                        | GitHub API, Linear, Jira, Bitbucket, GitLab, model providers, huggingface.co, CDNs for the native-chat shell                                              | The user's own accounts                                                                  | **fine**                                                                        |

One transport skips the proxy: `diagnostic-upload-http.ts:123` sends with raw `node:https`, not `getMainHttpClient`. It matters only if diagnostics upload is ever turned on.

### Release and publish identity (build time)

| What                                      | Where                                                                                                                                                                                                                                   | Route                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `appId`, `productName`, `protocols`       | `config/electron-builder.config.cjs:134,263-265`                                                                                                                                                                                        | **build**: the overlay (side-by-side P0) reads the seam                 |
| Executable and artifact names, maintainer | `:592` (`executableName: 'Orca'`), `:634,733,740,748,777,781,784-785,805`                                                                                                                                                               | **build**                                                               |
| Publish target                            | `:826-832` (`owner: 'stablyai'`), `config/dev-app-update.yml` (`stablyai`/`orca`, `orca-updater`)                                                                                                                                       | **build**                                                               |
| Team id                                   | `:259` `ORCA_MAC_TEAM_ID = '6CX3WHS9HZ'`, captured at `:903,915-916`                                                                                                                                                                    | **build**: S12's one env read                                           |
| Build constants                           | `electron.vite.config.ts:31-44,237-243` (`ORCA_BUILD_IDENTITY`, `ORCA_POSTHOG_WRITE_KEY`, `ORCA_DIAGNOSTICS_TOKEN_URL`)                                                                                                                 | **build**: the release script sets them from the seam (E7)              |
| Release-script repo fallbacks             | `assert-github-release-is-draft.mjs:97`, `create-draft-release.mjs:355`, `publish-complete-draft-releases.mjs:159`, `verify-release-required-assets.mjs:159`, `latest-stable-release.mjs:77` (`GITHUB_REPOSITORY \|\| 'stablyai/orca'`) | **build**: the release script exports `GITHUB_REPOSITORY` from the seam |
| `package.json`                            | `:2` `name: orca`, `:5` `homepage`, `:6` `author: stablyai`                                                                                                                                                                             | **build**: `extraMetadata` (side-by-side P0)                            |

### Install identity (runtime, per profile)

| What                                         | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Route                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `appName`, Keychain                          | `src/main/startup/profile-startup/dev-instance-identity.ts:7` (`BASE_APP_NAME = TMWK_PRODUCT_NAME`), `:8` `BASE_APP_USER_MODEL_ID = 'com.stablyai.orca'`                                                                                                                                                                                                                                                                                                              | **seam** (I0 for the name; the model id in P1)                                                   |
| userData rebuilt outside Electron (15 sites) | `src/cli/runtime/profile/metadata.ts:58,68,71`, `codex-home-paths.ts:80-85`, `serve-bundle-coordination.ts:49`, `logs-directory.ts:13,16,18` (capital `Orca`), `command-code-managed-script.ts:117-124`, `serve-service-unit.ts:72`, `orcad-app-paths.ts:20`, `model-cache-path.ts:58`, `bundled-skill-guides.ts:1986`, `launch-user-data-path.ts:17`, `configure-process.ts:234`; dev sniffs at `runtime-compatibility.ts:41` and `coordinator-task-dispatch.ts:105` | **seam** (`userDataDirName`, P1). Leave the dev `orca-dev` sniffs as they are                    |
| `~/.orca` on the desktop (14 files)          | 8 private `getOrcaDir()` copies (linear, minimax, speech, jira, bitbucket, encrypted-api-key-file-store, zcode, orcad plaintext migration), plus keybindings, theme sync, agent-teams shim, host terminal policy, uninstall cleanup                                                                                                                                                                                                                                   | **seam** (`appHomeDir()`, P3)                                                                    |
| `~/.orca` on remote hosts and WSL (~15)      | `orcad-remote-context.ts:151,185`, `remote-install-root.ts:1` (19 importers), `orcad-machine-home.ts:27,326`, WSL relay and guest files                                                                                                                                                                                                                                                                                                                               | **later** (P3c)                                                                                  |
| Hook paths and markers (~22)                 | `managed-hook-script-path.ts:6` (15 callers), `managed-hook-command-matching.ts:9-33` (27 users), `managed-hook-install-lock.ts:52`, `jcode/hook-settings.ts:40`, `grok-hook-owners.ts:13`, markers in 7 files, 17 remote sites                                                                                                                                                                                                                                       | **seam** (P3b; remote in P3c)                                                                    |
| CLI name (~15 logic files)                   | `cli-install-constants.ts:1-3`, `cli-install-location.ts:73,95,220,226`, `bundled-cli-launcher-path.ts:4,12,18`, `cli-command-inspection.ts:18,133-136`, `linux-bare-orca-dispatcher.ts:54,100,117`, `orca-cli-child-path.ts:38,52-63`, `orchestration-cli-command.ts:12-70`, `resources/darwin/bin/orca:22`                                                                                                                                                          | **seam** (`cliName`, P2). About 250 files of user-visible `orca <cmd>` text stay (S10, later P6) |
| URL scheme (desktop)                         | `orca-protocol-registration.ts:15,19`, `skill-share-link.ts:15,33`, `plugin-install-link.ts:11`, `macos-desktop-handoff.ts:82`                                                                                                                                                                                                                                                                                                                                        | **seam** (`urlScheme`, P4)                                                                       |
| URL scheme (pairing)                         | `pairing.ts:19,28,41,64`, `web-pairing.ts:46,74,182`, `mobile/app.json:9`                                                                                                                                                                                                                                                                                                                                                                                             | **fine**: the phone app owns `orca://pair` (S14)                                                 |
| Bundle ids and launchd labels                | `orca-install-identity.ts:27`, `local-build-compatibility-contract.ts:3`, `macos-tcc-prompt-watch.ts:11-18`, `serve-bundle-coordination.ts:6,9,65`, `serve-service-unit-removal.ts:50`, `macos-daemon-job-label.ts:11`, `macos-computer-use-permissions.ts:20`, `notification-system-settings-link.ts:3`, `macos-press-and-hold-default.ts:21`                                                                                                                        | **seam** (`bundleId`, `labelPrefix`; P0, P1, P3)                                                 |
| tmwk root                                    | `src/main/tmwk/main-home/main-home-paths.ts:13-24`                                                                                                                                                                                                                                                                                                                                                                                                                    | Own already; reads `homeDirName` in I0                                                           |

### Merged tmwk patches that hold identity values

| Patch                                | Upstream files                                                                                                                                                      | Value today                                                                                                                                    | After this guide                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| B0 / D55                             | none / `dev-instance-identity.ts`                                                                                                                                   | `tmwk-product-name.json` `{ productName }`, `TMWK_PRODUCT_NAME`                                                                                | `TMWK_PRODUCT_NAME` re-exported from the identity. **No Extend line changes**                                                       |
| B1                                   | `orca-i18n-instance.ts`                                                                                                                                             | `brandTranslatedText`                                                                                                                          | Unchanged: display text is branding, not identity (E2)                                                                              |
| B2, D55 scripts                      | `run-electron-vite-dev.mjs:54`, `dev-electron-bundle-identity.mjs:3`                                                                                                | `import … from tmwk-product-name.json`                                                                                                         | Re-point one import each to `tmwk-identity.json`                                                                                    |
| B2 src                               | `dev-instance-identity.ts`, `system-tray.ts:7`, `gpu-lifecycle.ts:28`, the three `index.html`-style pages                                                           | `TMWK_PRODUCT_NAME`; literal `<title>tmwk…</title>`                                                                                            | Constant: unchanged. HTML titles: baseline rows (static HTML can't import)                                                          |
| B3                                   | `orca-star.ts:1`, `Landing.tsx`, `StarNagCard.tsx`, `StarNagToastHost.tsx`, `GeneralSupportSection.tsx`, `SidebarSettingsHelpMenu.tsx`, `SidebarFeedbackDialog.tsx` | `TMWK_REPO`, `TMWK_REPO_URL`, `TMWK_SHOW_UPSTREAM_COMMUNITY_LINKS`                                                                             | `TMWK_REPO*` re-exported from the identity's `release.appRepo`. The community-links flag stays in branding                          |
| B6                                   | `createMainWindow.ts`, `main-window-close-lifecycle.ts`, `cli-user-facing-detail.ts`                                                                                | Translated product name; the `non-Orca` regex                                                                                                  | Unchanged (display)                                                                                                                 |
| B7b, logo mark (#51), B7 (#48, open) | 5 logo importers; app icon files                                                                                                                                    | Asset import paths                                                                                                                             | Unchanged: assets are branding                                                                                                      |
| License, footer                      | `pack-orcad-server-artifact.mjs`, `DocsFooter.tsx:85,92,100,103`                                                                                                    | Four literal `tmwkdev/tmwk-app` URLs in the footer                                                                                             | Baseline rows. The docs site is a separate build and can't import `src/shared` **(verify)**                                         |
| README (B5)                          | `README.md` (Adopted)                                                                                                                                               | Literal `tmwkdev/tmwk-app`                                                                                                                     | Adopted, fine                                                                                                                       |
| Telemetry v0 (in progress)           | `feedback-request.ts`, `feedback.ts`, `crash-reporting-submission.ts`, `diagnostic-upload-endpoint.ts`, three dialogs, `en.json`                                    | `src/shared/tmwk/identity/tmwk-egress.ts`; `tmwk-release-egress-check.json`; `config/scripts/tmwk/release-checks/verify-tmwk-no-telemetry.mjs` | `tmwk-egress.ts` becomes a view over the identity's `egress` section (same exports). The check moves to `config/tmwk/release/` (I1) |

## Decisions

These are numbered E1–E16 so they don't collide with D-numbers taken by tickets running at the same time, the side-by-side guide's S-numbers, or the brand plan's B-steps. They take the next free D-numbers when the guide is accepted and logged in [fork-ownership.md](fork-ownership.md#decision-log). **Owner call** marks a recommendation that changes a documented surface.

| #   | Decision                                      | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Where the seam lives.                         | `src/shared/tmwk/identity/` (Own), the folder the telemetry v0 patch already created. The side-by-side guide's `src/shared/tmwk/app-identity/` (S2, S5, S17) is folded in here, so there is one folder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| E2  | Identity vs branding.                         | **Branding** (`src/shared/tmwk/branding/`) holds what people _read_: the display name in text, the brand pass, community-link visibility, logo and icon assets. **Identity** holds what the app _is_ to the OS, the file system, the shell and the network: bundle id, `appName`, folders, command, scheme, labels, repos, hosts and keys. Rule of thumb: if changing the value moves data, breaks a link or changes who receives a request, it is identity. `TMWK_PRODUCT_NAME` is both. Identity owns it, and branding re-exports it. Feature flags go in neither.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| E3  | One data file, read by every runtime.         | `tmwk-identity.json` is the source of truth. `.cjs` and `.mjs` build scripts read it with `require`/`import … with { type: 'json' }`, and TypeScript imports it (the `tmwk-product-name.json` pattern, which it replaces). `tmwk-identity.ts` adds types and the few derived values. Nothing else repeats a literal from it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| E4  | Two install profiles; egress has none.        | Install identity has a `packaged` profile (tmwk: `~/.tmwk`, `tmwk`, `tmwk://`, `dev.tmwk.app`) and a `source` profile (today's dev values: `orca-dev`, `~/.orca`, `orca-dev`, `orca://`). This is S1's rule that source and dev runs behave exactly as today. **Egress has no profile**: feedback, diagnostics, analytics, the update repo and what's-new apply to every tmwk build, dev included. A dev build never sending to Orca is simpler and loses nothing. Dev stops showing Orca's what's-new. **Decided (owner):** "that's good."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| E5  | App repo vs upstream data repo.               | `release.appRepo: "tmwkdev/tmwk-app"` serves the update feed, release notes and the builds picker. `release.upstreamDataRepo: "stablyai/orca"` serves the agent-state rules and WSL hosts policy downloads, which are upstream's public data, read like any website. This replaces S11's proposed `APP_RELEASE_REPO` constant. `MAIN_RELEASE_REPO` keeps its name in Track code and reads `upstreamDataRepo`. Stable and RC map to `appRepo`. The dev channels are hidden in packaged tmwk (S11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| E6  | How Track code reads it: chokepoints first.   | In order of preference: (1) **an upstream chokepoint exists**, so patch the chokepoint once (`release-channel.ts`, `getSharedManagedScriptPath`, `getOrcaCloudAuthConfig`). (2) **Several copies of a literal sit near a chokepoint**, so make each copy call the chokepoint (one line each). (3) **The literal stands alone**, so add one Extend line that reads a named identity key. (4) **The value is build metadata**, so the overlay or release script sets it, with no source edit. Every Extend line imports from `src/shared/tmwk/identity/` only, so a conflict is always resolved by re-pointing one import.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| E7  | Build-time values.                            | The identity holds `build.constants`: `ORCA_BUILD_IDENTITY: "stable"` (telemetry decision 1), `ORCA_DIAGNOSTICS_TOKEN_URL: null`, and `ORCA_POSTHOG_WRITE_KEY`. The write key is **never in the repo**. The value is `{ keychainService: … } \| null`: null in v0, and a Keychain item name on the release Mac from telemetry stage 3. The release script (Own, local-ci-plan) exports exactly these and `unset`s any it marks null, so a stray shell export can't bake in Orca's key. Packaging metadata (`appId`, `productName`, `publish`, artifact names, team id) lives under `build.package`, which the side-by-side overlay reads.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E8  | Runtime profile detection.                    | `tmwkInstallProfile()` in `install-profile.ts`. In Electron main it is `app.isPackaged ? 'packaged' : 'source'`. In processes outside Electron (CLI, `orcad`, daemon, hook scripts) it reads `TMWK_INSTALL_PROFILE`, which packaged main sets for its children and the tmwk launchers set (side-by-side S17's boundary). It is never inferred from a path. With nothing set, the default is `source`, so a missing signal looks like dev, never like a packaged tmwk writing into Orca's folders **(verify** every packaged entry point gets the env**)**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| E9  | The egress section's shape.                   | `egress.feedback` (`apiUrl: null`, `issueRepo`), `egress.diagnostics` (`blockedHosts: ["orca.dev", "onorca.dev"]`), `egress.fencedHosts` (`["orca.dev"]`, the fence's list, E12), `egress.analytics` (`posthogHost: "https://us.i.posthog.com"`), `egress.whatsNew` (`changelogUrl: null`, `nudgeUrl: null`), `egress.plugins` (`killListUrl` and `statsUrl`, Orca's for now), and `egress.upstreamReads`. That last one is a short list of Orca hosts tmwk deliberately reads, each with a reason. Full Orca endpoint URLs to forbid are **not** in this file. They live in `config/tmwk/release/forbidden-egress.json`, outside the bundle, so the artifact check never finds its own strings (as the v0 patch already does).                                                                                                                                                                                                                                                                                                                                |
| E10 | The tripwire.                                 | `config/tmwk/identity/identity-tripwire.mjs` (Own). It snapshots six categories into baselines under `config/tmwk/identity/baseline/`, each row with a reason. On a sync and every night it reports anything new. See [The tripwire](#the-tripwire).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| E11 | Tripwire hits become tickets, not red builds. | A hit is routing work, not a breakage. The nightly opens (or updates) **one** "Identity tripwire" ticket per distinct hit set, separate from the "Nightly red" ticket, through the same outbox and delivery. **Decided (owner): own ticket.** On an upstream sync, the sync PR must clear every hit before it merges: route it, or add a baseline row with a reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| E12 | Runtime egress fence.                         | Defense in depth, for packaged tmwk only. Electron keeps one `onBeforeRequest` listener per session, and upstream already installs one on the default session (`installElectronProxyRequestGuard`, `src/main/network/electron-proxy-request-guard.ts:5-15`, called from `main-process-ready-foundation.ts:5`). A second listener would silently replace the proxy guard. So the fence is one Extend line inside that guard's callback, which asks an Own predicate first. It cancels requests to `egress.fencedHosts`, except URLs listed in `egress.upstreamReads`. That list is its own key: v0 fences `orca.dev` only, because Orca Cloud on `*.onorca.dev` stays usable until I5, and logs one local trace span per block. It catches an upstream `net.fetch` to a new `orca.dev` path in the days between the merge and the triage. It does not see raw `node:https` (`diagnostic-upload-http.ts`) **(verify** that main-process `net.fetch` passes through `webRequest` in Electron's version**)**. **Decided (owner, 2026-11-20): build it, after I3.** |
| E13 | No seams offered upstream.                    | **Decided (owner, 2026-11-20): "no seam back into the upstream."** tmwk never offers its routing changes to `stablyai/orca`, and nothing in this plan waits on upstream. Every value is read through tmwk's own Extend lines, chosen by E6. The cost is that those lines stay tmwk's to re-apply on conflicts; the patch log and the tripwire keep that cheap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| E14 | The map's new boundary.                       | fork-ownership.md gains an **Identity and egress** section and rule: _a value that names the app, its folders, command or scheme, or a remote host, repo or key, is read from `src/shared/tmwk/identity/`; no Track or Extend file holds it as a literal._ The section sits beside the two domains, because it cuts across both. The rows and patch-log lines follow the existing format.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| E15 | Orca Cloud and Orca Mobile.                   | **Decided (owner, 2026-11-20): "keep it for now but plan on killing Orca Cloud and Orca Mobile integrations."** v0 keeps them as they are (opt-in, each app signs in on its own). Removal is a planned step, [I5](#i5-remove-orca-cloud-and-orca-mobile-integrations-planned), routed and turned off through the seam: an `integrations` section in the identity (`orcaCloud: false`, `orcaMobile: false`) read at a few chokepoints, never by deleting upstream code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| E16 | Plugin install stats.                         | **Decided (owner, 2026-11-20): keep** (`egress.plugins.statsUrl` stays Orca's). The counts are public, display-only and failure-safe (`plugin-install-stats-service.ts:19-22`: "any failure only leaves counts hidden or old. Never feeds install decisions"). They come from the same host as the kill list, which tmwk keeps reading, so dropping them removes no contact with `orca.dev`, only the counts beside Orca plugins (which work in tmwk, S18). Dropping is a one-line JSON edit (`statsUrl: null`; the service then shows no counts **(verify)**). Dropping them later stays that one edit.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## The seam

### Files (all Own)

```
src/shared/tmwk/identity/
  tmwk-identity.json        the data: product, install profiles, release, egress, build
  tmwk-identity.ts          typed view; TMWK_IDENTITY, tmwkInstall(profile?), derived names
  install-profile.ts        tmwkInstallProfile() (E8)
  tmwk-egress.ts            from the telemetry v0 patch; becomes a view over TMWK_IDENTITY.egress
  app-home-dir.ts           appHomeDir(env), side-by-side S5 (built in P3)
  app-env-boundary.ts       toChildEnv / fromInheritedEnv, side-by-side S17 (built in P3b)
  app-hook-paths.ts         hook script path and matcher, side-by-side P3b
config/tmwk/
  identity/identity-tripwire.mjs, identity/baseline/*.txt   (I2)
  release/forbidden-egress.json, release/verify-tmwk-egress.mjs   (I1, moved from the v0 patch)
  electron-builder.tmwk.cjs                                (side-by-side P0)
```

### `tmwk-identity.json` (v0 values)

```json
{
  "product": {
    "productName": "tmwk",
    "bundleId": "dev.tmwk.app",
    "appUserModelId": "dev.tmwk.app"
  },
  "install": {
    "packaged": {
      "userDataDirName": "tmwk",
      "logsDirName": "tmwk",
      "homeDirName": ".tmwk",
      "remoteInstallDirName": ".tmwk-remote",
      "hooksDirName": "hooks",
      "cliName": "tmwk",
      "urlScheme": "tmwk",
      "labelPrefix": "dev.tmwk.app",
      "envPrefix": "TMWK_",
      "updaterCacheDirName": "tmwk-updater"
    },
    "source": {
      "userDataDirName": "orca-dev",
      "logsDirName": "Orca",
      "homeDirName": ".orca",
      "remoteInstallDirName": ".orca-remote",
      "hooksDirName": "agent-hooks",
      "cliName": "orca-dev",
      "urlScheme": "orca",
      "labelPrefix": "com.stablyai.orca",
      "envPrefix": "ORCA_",
      "updaterCacheDirName": "orca-updater"
    }
  },
  "release": {
    "appRepo": "tmwkdev/tmwk-app",
    "upstreamDataRepo": "stablyai/orca",
    "channels": ["stable"]
  },
  "egress": {
    "feedback": { "apiUrl": null, "issueRepo": "tmwkdev/tmwk-app" },
    "diagnostics": { "blockedHosts": ["orca.dev", "onorca.dev"] },
    "fencedHosts": ["orca.dev"],
    "analytics": { "posthogHost": "https://us.i.posthog.com" },
    "whatsNew": { "changelogUrl": null, "nudgeUrl": null },
    "plugins": {
      "killListUrl": "https://orca.dev/plugins/kill-list.json",
      "statsUrl": "https://orca.dev/plugins/stats.json"
    },
    "upstreamReads": [
      {
        "url": "https://orca.dev/plugins/",
        "why": "plugin safety list and stats (telemetry decision 4)"
      },
      {
        "url": "https://github.com/stablyai/",
        "why": "plugin catalogs (S18) and upstream data (E5)"
      }
    ]
  },
  "build": {
    "constants": {
      "ORCA_BUILD_IDENTITY": "stable",
      "ORCA_DIAGNOSTICS_TOKEN_URL": null,
      "ORCA_POSTHOG_WRITE_KEY": null
    },
    "package": {
      "publish": { "owner": "tmwkdev", "repo": "tmwk-app" },
      "macTeamIdEnv": "ORCA_MAC_TEAM_ID_OVERRIDE"
    }
  }
}
```

The `source` profile's values are a description of upstream's dev defaults, so the code reading it can stay a one-line swap. `labelPrefix` stays `com.stablyai.orca` in source, because dev labels are keyed by userData today (`macos-daemon-job-label.ts:11`) and moving them changes nothing for the user **(verify)**. `ORCA_POSTHOG_WRITE_KEY` becomes `{ "keychainService": "dev.tmwk.release", "account": "POSTHOG_WRITE_KEY" }` at telemetry stage 3.

### How an Extend line reads it

```ts
// release-channel.ts (Extend, one import + two values)
import { TMWK_IDENTITY } from '../tmwk/identity/tmwk-identity'
export const MAIN_RELEASE_REPO = TMWK_IDENTITY.release.upstreamDataRepo
const CHANNEL_RELEASE_REPOS = { stable: TMWK_IDENTITY.release.appRepo, rc: TMWK_IDENTITY.release.appRepo, … }
```

Each Extend line names one key. It never copies a value or branches on "is this tmwk". The profile is chosen inside the identity module. A patch-log line names the key, so a conflicting merge is re-applied by re-reading the log.

### Build-time vs runtime

| Kind                     | Examples                                                                                                                    | Set by                                                                                                      | Read by                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Packaging metadata       | `appId`, `productName`, `extraMetadata.name`, `protocols`, executable and artifact names, `publish`, team id, usage strings | The overlay `config/tmwk/electron-builder.tmwk.cjs`, from `product`, `install.packaged` and `build.package` | electron-builder. No source edit (side-by-side S3, S12) |
| Baked JS constants       | `ORCA_BUILD_IDENTITY`, `ORCA_POSTHOG_WRITE_KEY`, `ORCA_DIAGNOSTICS_TOKEN_URL`                                               | The release script, from `build.constants` (E7)                                                             | `electron.vite.config.ts` `define`, unchanged (Track)   |
| Runtime egress           | Feedback, diagnostics block list, PostHog host, update repo, what's-new, plugin endpoints                                   | `tmwk-identity.json` `egress` and `release`                                                                 | One Extend line per chokepoint (I1, I3)                 |
| Runtime install identity | Folders, command, scheme, labels, env prefix, bundle id at runtime                                                          | `install.<profile>`, chosen by E8                                                                           | Side-by-side P1–P4 Extend lines                         |

Nothing is read from a runtime env var for egress in a packaged build. `diagnostic-upload-endpoint.ts:19-30` lets an env URL win when the build identity is unset. E7 sets the identity to `stable`, and the v0 patch's `blockedHosts` check backs it up.

### How the merged patches move onto it

| Patch                             | Move                                                                                                                                                                                                                                         | Extend lines changed |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------: |
| B0, D55 (`TMWK_PRODUCT_NAME`)     | `tmwk-product-name.ts` re-exports `TMWK_IDENTITY.product.productName`. `tmwk-product-name.json` is deleted                                                                                                                                   |                    0 |
| B2, D55 scripts                   | `run-electron-vite-dev.mjs:54` and `dev-electron-bundle-identity.mjs:3` import `tmwk-identity.json` and read `.product.productName`                                                                                                          |                    2 |
| B3 (`TMWK_REPO`, `TMWK_REPO_URL`) | Re-exported from `release.appRepo`. The 6 importers are unchanged                                                                                                                                                                            |                    0 |
| B3 community-links flag           | Stays in branding (E2)                                                                                                                                                                                                                       |                    0 |
| Footer, index.html titles, README | Baseline rows (`tmwk-literal` category) with reasons                                                                                                                                                                                         |                    0 |
| Telemetry v0                      | `TMWK_EGRESS` reads `TMWK_IDENTITY.egress`, with the same exports. `tmwk-egress.ts` stops importing `TMWK_REPO` from branding (the dependency reverses). The release check moves to `config/tmwk/release/` and reads `forbidden-egress.json` |  0 in upstream files |
| B1, B6, B7, B7b, logo             | Display and assets: branding, unchanged                                                                                                                                                                                                      |                    0 |

So the migration touches two Extend lines in upstream files. Everything else changes inside Own code.

## The tripwire

### What it detects

The script scans tracked files outside Own paths (`**/tmwk/**`, `**/main-chat/**`, `docs/tmwk/**`, `config/tmwk/**`, the Adopted files) and outside tests, fixtures and locale catalogs. It also skips `.github/**` (Actions is off), `mobile/**` (not shipped), `docs/**`, `cloud/**` and `Casks/**`. That leaves `src/**`, `resources/**`, `config/**`, `native/**`, `skills/**`, `electron.vite.config.ts`, `vite.*.config.ts` and `package.json`.

| Category         | What counts                                                                                                                                               | Baseline format                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `upstream-host`  | `orca\.dev`, `onorca\.dev`, `stablyai`, `posthog`, `com\.stablyai` (comments stripped, as `check-path-literal-ratchet.mjs` does)                          | count per file, `<n> <path> # reason` |
| `outbound-host`  | The distinct hosts in `https?://` literals in `src/main`, `src/shared`, `src/cli`, `src/wsl-guest`, `src/preload`                                         | one host per line, `# reason`         |
| `env-name`       | Distinct `ORCA_[A-Z0-9_]+` names read as env: `process.env.X`, `env.X`, `env['X']`, and shell `$X`/`${X…}` in `resources/**` and generated-script sources | one name per line                     |
| `build-constant` | Keys of every `define:` block in `electron.vite.config.ts` and `vite.*.config.ts`, plus the names declared in `src/types/build-constants.d.ts`            | one name per line                     |
| `home-path`      | `'.orca'`, `/.orca/`, `.orca-remote`, `.orca-wsl`, `.orca-relay`, `` `.orca-${ `` and `agent-hooks/` as path segments                                     | count per file                        |
| `tmwk-literal`   | `tmwkdev/tmwk-app`, `dev.tmwk.app`, `tmwk://`, `~/.tmwk` outside Own paths (a tmwk value that skipped the seam)                                           | count per file                        |

A hit is a count above the baseline for a file, or a name or host not in its list. A count _below_ the baseline is reported as progress and lowered by `--update`. It never fails.

### Implementation

- `config/tmwk/identity/identity-tripwire.mjs` (Own). It reuses upstream's ratchet library by import, `config/scripts/static-analysis/ratchet-baseline/ratchet-baseline.mjs`: `listTrackedFiles`, `readTrackedSources`, `parseCountBaseline`, `parseCountNotes`, `formatCountBaseline`, `diffCounts`, `parseEntryBaseline`, `diffEntries`. It does not call `runCountRatchet`, because that fails on shrinkage too. If upstream moves the library, copy the eight functions into `config/tmwk/identity/` (they are pure).
- Flags:
  - `--check` (default): exits 1 on any hit and prints `category path: now N, baseline M` or `category new: NAME`.
  - `--json <file>`: writes `{ hits: [{ category, path?, value, now, allowed, lines: [n…] }], improved: […] }`.
  - `--update`: lowers counts, drops removed names, and keeps every row's reason.
  - `--accept <category> <path|value> "<reason>"`: adds one row. A reason is mandatory, and `--accept` refuses an empty one.
  - `--diff <base>`: limits the report to files changed in `git diff --name-only <base>...HEAD`, and prints the added lines for each hit, so a sync reviewer sees code, not counts.
- Baselines: `config/tmwk/identity/baseline/{upstream-host,home-path,tmwk-literal}.txt` (counts) and `{outbound-hosts,env-names,build-constants}.txt` (entries). The first commit generates them from today's tree, and every row starts with a reason taken from the [Inventory](#inventory): `fine: upstream docs link`, `routed: I3`, `later: P3c remote host`, `fine: Orca Cloud, user opt-in`, and so on. **Each baseline is the inventory, kept current.**
- `package.json` (Extend, one line): `"tmwk:identity-tripwire": "node config/tmwk/identity/identity-tripwire.mjs"`.
- The tripwire sees literals only. A host built from parts, or an env name built with a template, is caught by the runtime checks: the runbook's proxy watch, side-by-side check 5's `ps eww` sweep, and E12 if it is built.

### Where it runs

1. **Upstream sync.** Add a step to [Syncing with upstream](fork-ownership.md#syncing-with-upstream), after the merge and before `pnpm check:changed`. On the `upstream-sync` branch, run `pnpm tmwk:identity-tripwire --diff origin/main`. Every hit is cleared in the sync PR:
   - **route** it (an Extend line reading the seam, logged), or
   - **accept** it with a reason, or
   - **defer** it, by accepting it with `later: <ticket>` and opening that ticket.

   The PR description lists the hits and what was done with each. This needs the `upstream` remote: `git remote add upstream https://github.com/stablyai/orca.git` and `git remote set-url --push upstream DISABLED`, in each clone that runs syncs (I2).

2. **Nightly** (PR #54's `config/tmwk/local-ci/nightly.sh`). Add one step after `install`: `run_step identity-tripwire 5 node config/tmwk/identity/identity-tripwire.mjs --json "$RUN_DIR/identity-tripwire.json"`. Hits get their own ticket (E11):
   - **Ticket.** Title `Identity tripwire: <n> new (<categories>) at main@<sha7>`. The spec lists each hit with file:line and the added line, plus how to clear it (the three options above).
   - **Delivery.** Through the existing outbox and `deliver_ticket`. Its state lives in a second file, `$STATE/open-tripwire-ticket`, so the two tickets never supersede each other. `deliver_ticket` gains a state-file argument (Own, two lines).
   - **Dedupe.** The hit set's signature is `shasum` of the sorted `category value path`. A night with the same set updates the open ticket instead of opening another.
   - **Clearing.** Zero hits on a later night completes the ticket with `Tripwire clear at <sha7>`.
   - **The nightly's own result.** The step counts toward "Nightly red" only if the script _errors_ (exit 2). Hits (exit 1) report through the tripwire ticket instead. The GitHub-issue fallback lists category and path only, as `public_report` does.
3. **By hand.** `pnpm tmwk:identity-tripwire` before pushing a change that touches identity. It is not wired into `pnpm check:changed`: that would be an Extend in a busy Track script, and the nightly catches it within a day.

Main moves only through merged PRs, and the sync PR clears its hits. So a nightly hit means a tmwk PR added a literal, or a sync skipped the step. Both are worth a ticket.

## Build order

I0 first. I1 and I2 can run in parallel after I0. I3 follows I1. I4 follows I3 (decided). I5 comes after v0 ships. Each step is one reviewable PR. Then side-by-side P0–P5 run as reshaped in [How this reshapes the side-by-side guide](#how-this-reshapes-the-side-by-side-guide).

### I0. The seam, with no behavior change

Add (Own): `tmwk-identity.json`, `tmwk-identity.ts`, `install-profile.ts`.

Change:

- Own: `tmwk-product-name.ts` re-exports `TMWK_PRODUCT_NAME`, `TMWK_REPO` and `TMWK_REPO_URL` from the identity. Delete `tmwk-product-name.json`. `main-home-paths.ts` reads `install.packaged.homeDirName` for its packaged `~/.tmwk`.
- Extend (2 lines): `run-electron-vite-dev.mjs:54` and `dev-electron-bundle-identity.mjs:3` import `tmwk-identity.json`.
- Docs: map rows (E14) and patch-log lines.

Acceptance:

- `pnpm tc` passes.
- `pnpm dev` shows `tmwk: <branch>` in the dock and `tmwk Dev` in the menu bar, as before.
- `git grep tmwk-product-name.json` finds nothing.

### I1. Absorb the telemetry v0 patch

This depends on where that ticket is when I0 lands:

- **If it merged first:** a refactor PR. `TMWK_EGRESS` reads `TMWK_IDENTITY.egress`, and its derived exports stay the same. Its upstream Extend lines don't change.
- **If it hasn't:** it rebases onto I0 and reads the identity directly. Tell its owner: same exports, and the data lives in the JSON.

Either way:

- Move `config/scripts/tmwk/release-checks/verify-tmwk-no-telemetry.mjs` to `config/tmwk/release/verify-tmwk-egress.mjs`. `config/scripts/**` is upstream's tree, and tmwk config belongs under `config/tmwk/**` (local-ci-plan).
- Move `src/shared/tmwk/identity/tmwk-release-egress-check.json` to `config/tmwk/release/forbidden-egress.json`, so it stays out of the bundle and outside `src/`.
- The check also asserts that the baked constants equal `build.constants` (E7).

Acceptance: the v0 patch's own acceptance still holds (forms open a GitHub issue, and nothing posts to `orca.dev`). `node config/tmwk/release/verify-tmwk-egress.mjs` passes on a `pnpm build:release` output with no write key.

### I2. The tripwire

Add (Own):

- the script
- the six baselines, each row with a reason
- the nightly step and the tripwire ticket (on top of PR #54)
- a "Tripwire" note in local-ci-plan.md's step table

Extend: the `package.json` script line.

Docs: fork-ownership.md's sync step and the `upstream` remote command (already run on the agents' clone).

Spike first, and record the result here: how noisy is it?

- Use the `upstream` remote on the agents' clone (see [Preconditions](#preconditions)), or on the `~/ci` mirror once it exists. Check out upstream as of 30 days ago, generate baselines there, then run `--check` against `upstream/main`.
- Record hits per category for the month. If `env-name` alone gives more than about 20 hits a week **(verify)**, narrow it to names read in child-env builders and spawn paths (`ipc/pty/host-env/**`, `structured-session-child-env.ts`, `server-runtime-env.ts`, the launchers). Those are the names that cross the boundary, which is what S17 cares about.

Acceptance:

- On `origin/main`, `--check` exits 0.
- A scratch commit that adds `net.fetch('https://orca.dev/x')` to a Track file and `process.env.ORCA_NEW_THING` to another reports exactly two hits, and `--diff` prints both added lines.
- `NIGHTLY_FORCE_TRIPWIRE=1` (a test hook like the nightly's `NIGHTLY_FORCE_FAIL`) delivers one tripwire ticket to the Air's `main` Run. A second forced night updates it rather than adding a card, and a clean night completes it.

### I3. Route egress through the seam

Change (Extend; values from the identity):

- `src/shared/updater/release-channel.ts:22-38`: `MAIN_RELEASE_REPO` reads `upstreamDataRepo`. Stable and RC read `appRepo` (E5). Hide the dev channels when `release.channels` excludes them **(verify** that the picker and settings handle an empty dev-channel list**)**.
- `updater-setup.ts:174`, `updater-prerelease-feed.ts:15,20,72,78` and `updater-release-readiness.ts:4,110`: build URLs and regexes from `getReleaseRepoForChannel('stable')` (E6 rule 2). Escape the repo for the regexes.
- `posthog-transport.ts:82`: `host: TMWK_IDENTITY.egress.analytics.posthogHost`.
- `updater-changelog.ts:13,32`, `nudge-campaign.ts:12`: when the identity's URL is null, return "no changelog" and "no campaign" without fetching. Check how each caller handles empty results first (`updater-events.ts:135`, `updater-nudge.ts:21`) **(verify)**.
- `plugin-kill-list-service.ts:11`, `plugin-install-stats-service.ts:10`: read `egress.plugins.*`. The value is unchanged.
- Remove the side-by-side guide's P5 updater items (they are done here) and S11's `APP_RELEASE_REPO`.

Acceptance:

- With the identity as above, the stable feed URL is `https://github.com/tmwkdev/tmwk-app/releases/latest/download`.
- `wslHostsPolicyDownloadUrl('stable')` still names `stablyai/orca`.
- A dev run behind a proxy (or `nettop`) makes no request to `orca.dev/whats-new/*`.
- The tripwire baseline drops the routed rows (`--update`).

### I4. The egress fence (E12, decided)

Add (Own): `src/main/tmwk/identity/egress-fence.ts`, a pure `isFencedRequest(url)` plus the trace span. Change (Extend, one line): `electron-proxy-request-guard.ts`'s callback cancels when `isFencedRequest(details.url)` is true, before its proxy readiness check. Never add a second `onBeforeRequest` listener (it would replace the proxy guard). The updater's own session (`electron-updater-proxy-session.ts:4`) installs the same guard, so it is fenced too **(verify)**.

Acceptance: in a packaged build, a hand-made `net.fetch('https://orca.dev/v1/feedback')` from the main-process devtools is cancelled and leaves one span in `main.trace.ndjson`. Requests to `orca.dev/plugins/kill-list.json` still succeed.

### I5. Remove Orca Cloud and Orca Mobile integrations (planned)

Not part of v0 (E15). v0 keeps both. This step turns them off in tmwk through the seam. Upstream code is never deleted, and a sync never conflicts on removed code.

Add to `tmwk-identity.json`: `"integrations": { "orcaCloud": false, "orcaMobile": false }`. Both are profile-independent, like egress.

What it involves:

- **Spike first, and record the result here:** the full list of entry points. The research found the following. Each becomes one Extend line that returns early, or hides a control, when the flag is off:
  - **Cloud auth:** `getOrcaCloudAuthConfig` (`src/main/orca-profiles/cloud-auth/profile-cloud-auth-config.ts:44,107,114,123`) is the chokepoint for sign-in, org members, capability refresh, artifacts, connectors and skills cloud (callers in `orca-profiles/cloud-auth/`, `cloud-org/`, `skills/cloud/`, `artifact-cloud-service.ts:225`, `connector-cloud-install.ts:23`). One branch there returns a "cloud unavailable" config, so every caller gets its existing signed-out path **(verify** each caller handles it**)**.
  - **Startup services:** `src/main/startup/cloud-startup/` (`main-process-relay-startup.ts`, `main-process-push-startup.ts`, `main-process-connector-startup.ts`, `cloud-session-shutdown-flush.ts`), started from `main-process-runtime-launch.ts:19-20,34` and `main-window-core-services.ts:6`. They don't start when the flag is off.
  - **Push:** `src/main/runtime/push/` (`push-gateway-origin.ts:4`, `desktop-push-service.ts`), reached only from the push startup above.
  - **Mobile pairing and delivery:** the RPC namespaces `src/main/runtime/rpc/methods/pairing/` and `mobile-delivery/`, `runtime-rpc-mobile-pairing.ts`, the relay pairing producers (`src/shared/remote-runtime/pairing/pairing.ts`, `src/renderer/src/web/pairing/web-pairing.ts`), and `mobile-client-telemetry.ts`. Unregister the namespaces in `rpc-method-registry.ts`, which is already Extend.
  - **UI:** the Settings → Mobile section (`settings-navigation-capability-sections.ts:209-216`, `MobileSettingsPane.tsx`), the cloud sign-in and org surfaces, shared-skill links (`SkillsPage.tsx:172`, `SkillInstallReviewContent.tsx:47`), and the "reach your desktop from Orca Mobile" copy (`settings-navigation-capability-sections.ts:137`).
  - **Links in:** `skill-share-link.ts:2`'s host allowlist and the `orca://pair` route stop being accepted.
- **Egress:** add `onorca.dev` to `egress.fencedHosts`, so the fence (I4) blocks anything the flags missed, and the tripwire's `upstream-host` rows for those files change from `fine: Orca Cloud, user opt-in` to `routed: I5`.
- **Data:** a user who signed in to Orca Cloud or paired a phone in v0 keeps those records in userData. I5 leaves them unread and offers no migration (they are Orca's account data, not tmwk's).
- **Ownership:** new Extend rows for each chokepoint line, and the decision logged.
- **Remote hosts:** `orcad` on a remote host also starts the relay and push paths **(verify)**; the flags must reach it through the identity, not only main.

Acceptance:

- A packaged tmwk shows no Orca Cloud sign-in, no Mobile settings section and no share-to-cloud action.
- Behind a proxy, a session sends nothing to `*.onorca.dev`.
- `tmwk status` and the main chat work as before.
- Upstream's files merge clean at the next sync, apart from the logged Extend lines.

Depends on: I3, I4 and the v0 release. Its own ticket when the owner schedules it.

## How this reshapes the side-by-side guide

The side-by-side build is on hold until I0–I3 land. After that, each P-step reads the seam instead of adding its own constants.

| Side-by-side item                         | Change                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2 (one identity file at `app-identity/`) | Replaced by `src/shared/tmwk/identity/tmwk-identity.json` (E1, E3). S2's keys move to `product`, `install.packaged` and `release`                                                  |
| S1 (packaged builds only)                 | Implemented by E8's `tmwkInstallProfile()`. The `source` profile describes today's dev values                                                                                      |
| S5, S17, P3b's hook paths                 | Their Own files live in `src/shared/tmwk/identity/` (`app-home-dir.ts`, `app-env-boundary.ts`, `app-hook-paths.ts`)                                                                |
| S11 (`APP_RELEASE_REPO`)                  | Replaced by E5's `release.appRepo` and `release.upstreamDataRepo`. Done in I3                                                                                                      |
| S12 (team id env)                         | Unchanged. The env name comes from `build.package.macTeamIdEnv`                                                                                                                    |
| S22 (telemetry)                           | Moves here as egress (E7, E9, I1). S22 points to this guide                                                                                                                        |
| P0                                        | The overlay `require()`s `tmwk-identity.json` and repeats no literal. Otherwise unchanged                                                                                          |
| P1–P4                                     | Same edits. Each reads `tmwkInstall().<key>`. Each new Extend file gets a tripwire baseline row lowered by `--update`, so a later upstream re-introduction of the literal is a hit |
| P5                                        | The updater edits and nudge and changelog off are done in I3. P5 keeps the release script, which reads `build.constants` and `build.package` and runs `verify-tmwk-egress.mjs`     |
| Precondition table                        | Adds "the identity module exists (I0)" and "the tripwire is green (I2)"                                                                                                            |
| Build order                               | I0 → (I1, I2) → I3 → P0 → P1 → (P2, P3, P4) → P3b → P5                                                                                                                             |

## How this reshapes the telemetry plan

| Stage                          | Change                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. v0, nothing off the machine | The v0 patch is the seam's first consumer (I1). "What the release build must do" items 1 and 2 become the release script reading `build.constants` (E7). Item 4's inverted check is `config/tmwk/release/verify-tmwk-egress.mjs`                                                                      |
| 2. Local-only                  | Unchanged (Own code, no egress)                                                                                                                                                                                                                                                                       |
| 3. tmwk's PostHog              | A values edit: `build.constants.ORCA_POSTHOG_WRITE_KEY` becomes a Keychain reference, and `egress.analytics.posthogHost` is set to the project's region host. The host Extend already exists (I3). Event filtering is still the stage's own question. The inverted check flips to "the key is tmwk's" |
| 4. Orca's other GETs           | Changelog and nudge are already off (I3). Kill list and stats are routed with Orca's values. The stage's decision for them becomes a one-line JSON edit, and the tripwire's `upstreamReads` reasons record why                                                                                        |

## Ownership changes

- **New section** in fork-ownership.md: "Identity and egress", with E14's rule and a pointer here.
- **New Own rows:** `src/shared/tmwk/identity/**` (the seam; covered by `src/shared/tmwk/**`, but listed because Extend lines import it), `config/tmwk/**` (tripwire, release checks, the builder overlay, the nightly; local-ci-plan and side-by-side both expect this row), and `src/main/tmwk/identity/**` (I4, if built).
- **Changed row:** `src/shared/tmwk/branding/**` now says "names people read; identity values are in `identity/`" (E2).
- **New Extend rows, each with a patch-log line:** I0's two script imports, `package.json` (the script line), I3's nine files, and I4's one line in `electron-proxy-request-guard.ts`, and I5's chokepoint lines (planned).
- **Sync procedure:** a tripwire step, and the `upstream` remote command.
- **Guardrails:** "No Track or Extend file holds an identity or egress literal; `pnpm tmwk:identity-tripwire` reports them."
- **Expected Extend size for this guide:** 2 lines (I0), 1 (I2), about 14 (I3), 1 (I4). The side-by-side guide's P-steps keep their estimates. Each one reads a key and repeats no value.

## First-class citizens

- **Cross-platform.** The identity holds folder _names_, never full paths. Each platform's path is still built where it is today, so Windows `APPDATA`, XDG and macOS `Application Support` keep their own logic. The tripwire is Node, and runs on any OS. Its shell `$ORCA_*` scan covers `.sh`, `.cmd` and `.ps1` sources.
- **Remote hosts.** `install.packaged.remoteInstallDirName` is reserved for P3c. In v0 the remote host keeps upstream's layout (S15). The tripwire's `home-path` baseline marks the ~15 remote sites `later: P3c`, so a new one shows up as a hit.
- **Mobile.** Out of the tripwire's scope (not shipped). `orca://pair` stays upstream's (S14).
- **Folder workspaces.** Nothing here assumes git. The tripwire runs on tracked files of this repository only.

## Tests

Do not add tests by default ([AGENTS.md](../../AGENTS.md)). The ones worth adding fail on revert and hard-code their values:

- I2: `collectTripwireHits` (pure, takes sources and baselines). Given a Track source containing `fetch('https://orca.dev/x')` and an empty `upstream-host` baseline, it returns one hit `{ category: 'upstream-host', path, now: 1, allowed: 0 }`. The same source under `src/main/tmwk/` returns none. `process.env.ORCA_NEW_THING` with an `env-names` baseline that lacks it returns one hit.
- I2: `--accept` with an empty reason exits non-zero and writes nothing.
- I3: with the identity above, the stable feed URL is `https://github.com/tmwkdev/tmwk-app/releases/latest/download`, and `wslHostsPolicyDownloadUrl('stable')` names `stablyai/orca` (moved from the side-by-side guide's P5 test).
- I4: `isFencedRequest('https://orca.dev/v1/feedback')` is true, and `isFencedRequest('https://orca.dev/plugins/kill-list.json')` is false.

The prerelease feed's tag regexes (`updater-prerelease-feed.ts:20,78`) are private, so they are proved by runbook check 7, not a unit test.

No test for the JSON's values, the re-exports or the baselines' contents: those are constants.

## Validation runbook

Run on the MBP. Save evidence under `docs/tmwk/identity-egress/`.

| #   | Check                   | Evidence                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Seam in place           | `git grep -n "tmwk-product-name.json"` is empty. `pnpm dev` dock and menu names are unchanged (`01-dev.png`, CDP screenshot, `ORCA_BACKGROUND_LAUNCH=1`)                                                                                                                                                                              |
| 2   | Tripwire green on main  | `pnpm tmwk:identity-tripwire` exits 0 (`02-green.txt`)                                                                                                                                                                                                                                                                                |
| 3   | Tripwire catches a sync | On a scratch branch merged with `upstream/main`, `--diff origin/main` lists the hits with added lines (`03-sync.txt`). Record the hit count per category                                                                                                                                                                              |
| 4   | Noise                   | The 30-day spike result from I2 (`04-noise.txt`)                                                                                                                                                                                                                                                                                      |
| 5   | Nightly ticket          | A forced hit night creates one tripwire card in Needs you on the Air. A second forced night updates it. A clean night completes it (`05-ticket.png`, the outbox log)                                                                                                                                                                  |
| 6   | Egress on the wire      | Run a dev build (and later the packaged build) behind a proxy or `nettop` for one session: open, run a turn, open Settings → Privacy and Updates, quit. No requests to `orca.dev/whats-new`, `orca.dev/v1/feedback`, `orca.dev/diagnostics` or `us.i.posthog.com`. Plugin kill list and stats requests are expected (`06-egress.txt`) |
| 7   | Update feed             | The packaged build's update check requests `github.com/tmwkdev/tmwk-app` only (with side-by-side P5)                                                                                                                                                                                                                                  |
| 8   | Fence (I4)              | The blocked request leaves a span. The allowed request succeeds                                                                                                                                                                                                                                                                       |

Follow AGENTS.md for any agent-run UI check: `ORCA_BACKGROUND_LAUNCH=1`, CDP screenshots, and never `show()` a window. Before every push: `pnpm check:changed`.

## Risks

- **Tripwire noise.** Upstream adds `ORCA_*` names and docs links weekly. Too many hits and the ticket gets ignored. I2's spike measures it. The fallbacks are narrowing `env-name` to boundary files and grouping hits into one ticket per night (already the design).
- **Renames look like new hits.** An upstream file move shifts a count from one path to another. `--diff` shows the moved line, and `--update` plus `--accept` clears it, but a large upstream reshuffle makes a long sync review. The count-per-file format is the price of keeping reasons per file.
- **Literals only.** Hosts built from parts and env names built from templates are invisible to the tripwire. The runtime checks (runbook check 6, side-by-side check 5, E12) cover them.
- **The identity file becomes a dumping ground.** E2's rule and review keep feature flags and display text out. A key without an Extend reader is removed.
- **Profile mis-detection.** A packaged child that misses `TMWK_INSTALL_PROFILE` reads the `source` profile and writes to `~/.orca`. That is the safe direction for Orca's data only if Orca isn't installed. Side-by-side check 14 (hash Orca's files) catches it. E8 lists every entry point as a **(verify)**.
- **A rebase collision with the v0 patch.** Both touch `src/shared/tmwk/identity/` and the feedback dialog. I1 names the order, and the exports stay the same in both orders.
- **The docs footer can't import the seam.** It keeps literals with a baseline reason. If the docs site is ever built for tmwk, it gets its own small JSON import **(verify)**.
- **Importing upstream's ratchet library.** If upstream renames it, the tripwire breaks at the next sync. That is loud (exit 2, a "Nightly red"), and the fix is copying eight pure functions.
- **Sync discipline.** The tripwire only helps if the sync step runs. The nightly is the backstop: anything a sync skipped shows up the next night.

## Deferred

- Removing Orca Cloud and Orca Mobile integrations (I5, planned after v0, E15). Mobile app identity stays out of scope (not shipped; D52).
- Remote-host identity (P3c) and user-visible `orca <cmd>` text (P6). The tripwire tracks both as `later` rows. Renderer docs links to `orca.dev` stay (decided), as `fine` rows.
- A tmwk "what's new" feed, docs site and privacy page (telemetry stage 3, brand plan).
- Wiring the tripwire into `pnpm check:changed`.

Never: renaming `ORCA_*` names in code, editing upstream's release workflows, or changing `orca://pair`.

## Doc updates

- `docs/tmwk/fork-ownership.md`: the Identity and egress section, rows, guardrail, sync step and decision-log entry (in this PR, marked planned where the code doesn't exist yet).
- `docs/tmwk/README.md`: link this guide (in this PR).
- `docs/tmwk/side-by-side-install-guide.md`: when I0 lands, S2, S11 and S22 point here, P5 loses the updater items, and the build order gains I0–I3 (the table in [How this reshapes the side-by-side guide](#how-this-reshapes-the-side-by-side-guide)).
- `docs/tmwk/telemetry-plan.md` (PR #53): the stage rows in [How this reshapes the telemetry plan](#how-this-reshapes-the-telemetry-plan), when it merges.
- `docs/tmwk/local-ci-plan.md` (PR #50): the tripwire step in the nightly table, and the release script reading `build.constants`.

## Owner decisions

Answered by the owner on 2026-11-20 and recorded in the decisions above:

| Question                                            | Answer                                                                                           | Where                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Orca Cloud in packaged tmwk                         | "Let's keep it for now but plan on killing Orca Cloud and Orca Mobile integrations."             | E15, I5                                     |
| Plugin kill list                                    | "Let's keep the kill list."                                                                      | Inventory, E9                               |
| Build the egress fence                              | Yes                                                                                              | E12, I4                                     |
| Offer seams upstream                                | "Nah, no seam back into the upstream."                                                           | E13; I5 is now the Cloud and Mobile removal |
| The `upstream` remote                               | "Let's do it." Added by the partner on the agents' clone; the `~/ci` mirror gets it when created | [Preconditions](#preconditions)             |
| Renderer docs links to `orca.dev`                   | Leave them                                                                                       | Inventory, Deferred                         |
| Tripwire tickets                                    | Own ticket, separate from "Nightly red"                                                          | E11                                         |
| Dev builds stop fetching Orca's changelog and nudge | "That's good."                                                                                   | E4                                          |
| Plugin install stats                                | Keep                                                                                             | E16, Inventory                              |

## Open items

None. Plugin install stats were the last; the owner kept them (E16).
