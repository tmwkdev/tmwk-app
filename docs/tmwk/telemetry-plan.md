# Telemetry plan

Status: decided (2026-11-20). The owner accepted the staged plan and answered the open
questions; see [Decisions](#decisions). Docs only.

**v0: telemetry is off.** tmwk never sends to Orca's PostHog, Orca's diagnostics endpoint or
Orca's feedback endpoint ([side-by-side guide](side-by-side-install-guide.md) S22;
[local-ci-plan.md](local-ci-plan.md) release decision 4). **Later**, tmwk sends to its own
PostHog Cloud project, with its own write key and its own small event list. This doc covers
what Orca collects today, what tmwk wants to learn, the options, how to keep v0 off safely, and
the stages.

Every code reference was read on `origin/main` at `00407646f7`. Items not checked against code
or a live system are marked **(verify)**.

## Summary

- Orca has three ways to send data off the machine: **PostHog product analytics** (111 event
  types), **diagnostic bundle upload** to `orca.dev/diagnostics`, and **feedback and crash
  report forms** that post to `orca.dev/v1/feedback`. Crash dumps themselves never leave the
  machine.
- The first two are gated by constants baked in at build time. A tmwk build that leaves them
  unset sends nothing to PostHog and has no built-in diagnostics endpoint. S22 holds for them.
- **The third is not gated.** `FEEDBACK_API_URL` is hard-coded, so in a tmwk build the feedback
  dialog, the crash report dialog and the language request form would still post to Orca's
  server when the user clicks Send. Decided: in v0 those forms copy the report and open a
  GitHub issue on `tmwkdev/tmwk-app`. A separate ticket is patching the hard-coded endpoints now
  (see [Keeping v0 off](#keeping-v0-off-safely)).
- `verify-telemetry-constants.mjs`, which the local release plan runs at step 10, **fails** on a
  build with no write key. tmwk needs its own inverted check instead.
- Stages: send nothing in v0. Next, make tmwk's own failures visible **on the owner's machine**,
  reusing Orca's local trace file. Once tmwk's PostHog project exists, send error reports and a
  small tmwk event list there automatically, opt-out like Orca. Until then, anything public goes
  to GitHub issues.

## What Orca collects today

### 1. PostHog product analytics

**Where it lives.** One client in the main process: `src/main/telemetry/client.ts`. The renderer
bundles no PostHog SDK. It calls `window.api` and main validates
(`src/renderer/src/diagnostics/telemetry/telemetry.ts:1-2`).

**Destination.** `https://us.i.posthog.com` (`src/main/telemetry/posthog-transport.ts:82`).
GeoIP enrichment is off (`:86`), cookies are omitted, and requests go through the app's proxy
settings (`:91`). Events batch at 20 or every 10 s (`:9-10`), and up to 5,000 queue offline.

**The gates.** All must pass to send:

1. `const TELEMETRY_ENABLED = true` (`client.ts:24`), a source-level kill switch.
2. `IS_OFFICIAL_BUILD` (`client.ts:35-38`): `ORCA_BUILD_IDENTITY` is `stable` or `rc` **and**
   `ORCA_POSTHOG_WRITE_KEY` is non-empty. Both are compile-time `define`s
   (`electron.vite.config.ts:31-40`, `:238-239`). With no env value at build time they become the
   literal `null`. There is no runtime env fallback (`src/types/build-constants.d.ts:1-4`).
3. Upstream sets them only in release CI: `release-mac-build.yml:190-193`,
   `release-cut.yml:1213-1217`, `release-javascript.yml:93-96`. The key is the
   `secrets.ORCA_POSTHOG_WRITE_KEY` repository secret.
4. Consent (`src/main/telemetry/consent.ts`), read live on every event:
   - `DO_NOT_TRACK=1`, `ORCA_TELEMETRY_DISABLED=1`, or any CI marker (`CI`, `GITHUB_ACTIONS`,
     …) disables it and beats the stored choice (`:52-63`).
   - Otherwise `settings.telemetry.optedIn`: `true` sends, `false` doesn't, `null` waits on the
     first-launch banner (`:76-90`).
5. Per-event sampling, burst caps, and strict zod validation of every property
   (`client.ts:136-235`, `validator.ts`). Schemas are `.strict()`, so unknown keys are rejected.

**Default is opt-out.** On first load, the migration sets `optedIn: true` for a fresh install and
`null` (show the banner) for an install that existed before telemetry shipped
(`src/main/persistence/loading-store/profile-loading/loaded-cohort-migrations.ts:180-185`). It
also mints a random `installId` (`:186-189`).

**Consent UX.** Settings → Privacy has one switch that calls `setOptIn`
(`src/renderer/src/components/settings/privacy/PrivacyPane.tsx:78-86`). The first-launch banner
and the Privacy pane link to `https://orca.dev/docs/telemetry`
(`telemetry.ts:14`). Opting out sends one final `telemetry_opted_out` event before the SDK stops
(`src/main/telemetry/opt-out-capture.ts`).

**What every event carries** (`posthog-transport.ts:12-27`): `app_version`, `platform`, `arch`,
`os_release`, `install_id` (random UUID, also the PostHog `distinct_id`), `session_id` (random
per launch), and `orca_channel`. Person profiles are off per capture
(`client.ts:247`). Experiment cohort properties are added on official builds
(`client.ts:81`).

**Event catalog.** 111 events are registered in `src/shared/telemetry/telemetry-event-registry.ts`.
By family:

| Family                 | Events (examples)                                                                                                                                                                     | Contents                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle and adoption | `app_opened`, `meaningful_activity_day`, `first_agent_interaction`, `settings_changed`, `app_starred_orca`                                                                            | Cohort (repo count bucket), dashboard flag, which setting changed                                                                                               |
| Onboarding             | `onboarding_started` … `onboarding_completed`, `onboarding_step_*`, `onboarding_agent_picked`, `onboarding_language_*`, `onboarding_ghostty_*`, `activation_checklist_item_completed` | Step names, picked agent, language, skip/dismiss                                                                                                                |
| Repos and workspaces   | `repo_added`, `add_repo_*`, `workspace_created`, `workspace_create_failed`, `worktree_card_*`                                                                                         | Enum source/kind, counts, failure class                                                                                                                         |
| Agents                 | `agent_started`, `agent_prompt_sent`, `agent_error`, `agent_token_usage`, `agent_hook_*`, `codex_trust_grant`                                                                         | Agent kind, enum error class (no messages or stacks, `telemetry-app-event-schemas.ts:138`), token counts per provider (`telemetry-agent-token-usage-schema.ts`) |
| Native chat            | `native_chat_message_sent`, `native_chat_prompt_submitted`, `native_chat_picker_*`, `native_chat_skill_discovery`, `native_chat_toggled`                                              | Agent kind, runtime target, client (desktop or mobile). No prompt text                                                                                          |
| Feature education      | `feature_wall_*`, `*_feature_tip_*`, `contextual_tour_*`, `setup_guide_*`, `star_nag_outcome`                                                                                         | Which tile, tip, or tour; outcome                                                                                                                               |
| Runtime health         | `daemon_*`, `main_thread_hang_detected`, `runtime_rpc_start_failed`, `remote_outbound_budget_close`, `profile_state_authority_selected`                                               | Enum outcomes, durations, counts                                                                                                                                |
| Remote and SSH         | `ssh_host_server_*`, `ssh_remote_runtime_resolved`                                                                                                                                    | Decision, failure class                                                                                                                                         |
| Windows/WSL            | `wsl_move*`, `wsl_usage_snapshot`                                                                                                                                                     | Daily WSL usage, Windows only (`src/main/telemetry/wsl-usage-reporter.ts`)                                                                                      |
| Mobile                 | `mobile_session_opened`, `native_chat_message_sent` with `client: 'mobile'`                                                                                                           | Surface (chat or terminal), agent kind                                                                                                                          |
| Plugins, editor, misc  | `plugin_installed`, `editor_external_change_conflict_*`, `terminal_pane_split`, `toast_action_over_modal`                                                                             | Enum outcomes                                                                                                                                                   |
| Consent                | `telemetry_opted_in`, `telemetry_opted_out`                                                                                                                                           | Where the change came from                                                                                                                                      |

### 2. Diagnostic bundles (manual upload)

- **Local first.** The main process always writes spans to `<userData>/logs/main.trace.ndjson`,
  with `orcad.trace.ndjson` and `daemon.log` beside it
  (`src/main/observability/logs-directory.ts`). Files rotate at 10 MB × 10
  (`local-file-sink.ts:7-8`) and are mode `0600` in a `0700` directory (`:11-12`).
- **Redaction.** `src/main/observability/redactor.ts` runs at sink write, at bundle collection and
  at server ingest. It strips provider keys (Anthropic, OpenAI, GitHub, AWS, Slack), JWTs, PEM
  blocks, `Bearer` tokens, URL user info, `.env`-style lines, and blocked attribute names
  (`env`, `authorization`, `api_key`, …).
- **Bundle.** `bundle.ts` collects the newest 30 minutes of redacted records, up to 4 MiB, as NDJSON
  with a header: random `bundle_submission_id` (never `install_id`), app version, platform,
  arch, OS release, channel (`bundle.ts:29-46`). Main keeps the previewed bytes so the renderer
  can't swap them.
- **Upload.** The user reviews and uploads from Settings → Privacy
  (`PrivacyDiagnosticsSection.tsx`, IPC in `src/main/ipc/diagnostics.ts:205-286`). The flow:
  POST to the token endpoint, then POST the bundle to the returned `upload_url`, which must be
  on the same host (`diagnostic-bundle-upload.ts:34-79`, `:86-109`). A ticket ID comes back.
  The user can delete it via `/diagnostics/delete/<ticket>`.
- **Endpoint.** `ORCA_DIAGNOSTICS_TOKEN_URL`, a build constant set to
  `https://orca.dev/diagnostics/token` in every upstream build workflow, including the
  daily/hourly/ad hoc ones (e.g. `release-mac-build.yml:192`). If the build identity is set,
  the constant wins. **If the build identity is unset, a runtime env
  `ORCA_DIAGNOSTICS_TOKEN_URL` overrides the null constant**
  (`src/main/observability/diagnostic-upload-endpoint.ts:19-30`).
- **Kill switches.** `DO_NOT_TRACK` / `ORCA_TELEMETRY_DISABLED` stop uploads and keep local
  logs. `ORCA_DIAGNOSTICS_DISABLED` or CI stops both (`src/main/observability/index.ts:63-96`).

### 3. Crash reporting

- **Capture is local.** Electron Crashpad runs with `uploadToServer: false` and no `submitURL`
  (`src/main/crash-reporting/capture/crashpad-capture.ts:51-53`). Minidumps stay in Crashpad's
  directory and are pruned to 128 MB / 64 dumps (`:19-23`). Main parses the minidump into a text
  signature locally.
- **Reports.** Process-gone events, renderer errors, React error boundaries and breadcrumbs
  become reports stored in `<userData>/crash-reports.json`
  (`src/main/crash-reporting/reports/crash-report-store.ts:89-90`).
- **Redactor.** `src/shared/crash-reporting/crash-report-redaction.ts`: GitHub/GitLab/OpenAI/Slack/
  AWS tokens, `Bearer`, private keys, `user:pass@` URLs, and `token=`/`password=` assignments.
  Strings cap at 240 chars, stacks at 4,000, breadcrumbs at 30 (`:7-24`).
- **Sending is manual.** The crash report dialog (`CrashReportDialogSurface.tsx:136`) calls
  `crashReports:submit`. It formats the report, optionally attaches a diagnostic bundle, and sends
  it through the **feedback** endpoint as `submissionType: 'crash'`
  (`src/main/ipc/crash-reporting/crash-reporting-submission.ts:43-60`). A "copy text" path exists
  too (`reports/crash-report-copy-text.ts`).

### 4. Feedback forms

- `FEEDBACK_API_URL = 'https://orca.dev/v1/feedback'` is a hard-coded literal
  (`src/main/ipc/feedback/feedback-request.ts:9`). No build constant or consent gate applies.
- The body carries the feedback text, the type (`feedback` or `crash`), GitHub login and email
  unless "submit anonymously" is checked, app version, platform, OS release and arch. A crash
  adds the diagnostic bundle. Feedback can include images (`feedback.ts:31-51`).
- Callers: the sidebar feedback dialog (`SidebarFeedbackDialog.tsx:153`), the language request
  form (`LanguageRequestForm.tsx:44`), and the crash report dialog. In tmwk, brand plan B3
  already hides the dialog's upstream community links (`SidebarFeedbackDialog.tsx:268`), but
  the Send button still posts to Orca.

### 5. Usage tracking (local)

The token-usage views (`src/main/claude-usage/`, `codex-usage/`, `opencode-usage/`, …) scan the
agents' local transcript files and keep a local store. They send nothing themselves. The only
off-machine copy is the `agent_token_usage` PostHog event (token counts, provider, random
session ID), sent from `src/main/backend-desktop/backend-desktop-capabilities.ts:48` through the
same gated `track()`.

### 6. Mobile

The phone app sends no telemetry of its own. The desktop host counts what reaches it
(`src/main/telemetry/mobile-client-telemetry.ts:1`, `mobile_session_opened` and mobile
`native_chat_message_sent`). `mobile/package.json` has no analytics or crash SDK.
`mobile/google-services.json` is Firebase config, for push **(verify)**. tmwk does not ship the
mobile app today **(verify)**.

### 7. Other calls to Orca's servers (not telemetry)

These are plain GETs with no install ID, but each one tells Orca's servers an IP address and app
version. They also show Orca content. They are outside S22. Decided: leave them for now and
handle them in [stage 4](#stages):

| Call                                                     | Code                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What's-new changelog                                     | `src/main/updater/releases/updater-changelog.ts:32` (`orca.dev/whats-new/changelog.json`)                                                                                                                                                              |
| Update nudge campaign                                    | `src/main/updater/nudges/nudge-campaign.ts:12` (`orca.dev/whats-new/nudge.json`)                                                                                                                                                                       |
| Plugin kill list, install stats                          | `src/main/plugins/catalog/plugin-kill-list-service.ts:11`, `plugin-install-stats-service.ts:10`                                                                                                                                                        |
| Cloud features (sign-in, relay, push, share, connectors) | `orca-profiles/cloud-auth/profile-cloud-auth-config.ts:25-27`, `runtime/push/push-gateway-origin.ts:4`, `artifacts/artifact-cloud-config.ts:3`, `connector-cloud/connector-origin.ts:5`. Used only when the user turns on a cloud feature **(verify)** |

## What tmwk wants to learn

tmwk is a personal tool now and a public beta later. Orca's catalog answers Orca's questions
(funnels, feature tips, onboarding). Most of them aren't tmwk's. tmwk's questions are fewer:

| Question                  | Signal                                                                                                                                                                                                                                        | Personal tool (on the machine)                                         | Public beta (sent off)                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Does it crash?            | Main/renderer/process-gone crash reports                                                                                                                                                                                                      | Already local: `crash-reports.json` and the crash dialog               | Yes: the most valuable thing to send            |
| Do tmwk's own jobs fail?  | Rollover, working summary, main-session replace, ticket refresh, away digest failures. Today these only `console.error` (`src/main/tmwk/rollover/run-rollover.ts:75-82`, `automatic-rollover-trigger.ts:33-55`, `standing-rules-flush.ts:95`) | Yes: write them to the local trace and show them                       | Yes, as error class + count                     |
| Do owners finish or stop? | Ticket outcomes: done, failed, abandoned, stalled; time to done                                                                                                                                                                               | Yes: the tmwk store already holds tickets; a local view can count them | Maybe, as counts only                           |
| Is the main chat healthy? | Context usage at rollover, rollover count per day, fallback-summary rate (`fallback-summary.ts`)                                                                                                                                              | Yes                                                                    | Maybe                                           |
| Do people update?         | App version per active install                                                                                                                                                                                                                | No need                                                                | Yes, if it's needed to drop old versions        |
| Does anyone use it?       | Daily active installs                                                                                                                                                                                                                         | No need                                                                | Optional; the crash stream gives a rough number |

Most of this is useful **on the owner's machine first**. That costs nothing, needs no consent,
and fits the product. tmwk should be simple to run and should tell the owner what went wrong
without them filing a ticket against themselves.

## Options

| Option                              | What it is                                                                                                                                                        | Cost                                                                                                                                                                                                                          | Privacy                                                                                                                                    | Consent UX                                                                       | Ownership fit                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. None**                         | v0 as decided. Nothing leaves the machine                                                                                                                         | $0                                                                                                                                                                                                                            | Best                                                                                                                                       | None needed. But the Privacy switch still shows and defaults on (see below)      | No code. Needs the feedback Extend to be actually true                                                                                                                                   |
| **B. Local-only diagnostics**       | tmwk failures and outcomes go to the existing local trace (`startSpan` from `src/main/observability/tracer.ts:113`) and a local health view or `orca tmwk doctor` | $0, a few days of work                                                                                                                                                                                                        | Best: nothing leaves                                                                                                                       | None. Data is the owner's own                                                    | Own code (`src/main/tmwk/**`) calling Orca's tracer API. No Track edits. The import gate only fences orchestration (`config/ast-grep/rules/tmwk-no-orchestration-internals.yml`)         |
| **C. Crash and error reports only** | Point Orca's existing crash/feedback flow at a tmwk endpoint, or replace Send with "copy report + open a GitHub issue on tmwkdev/tmwk-app"                        | Issue flow: $0. Hosted error tracker: free tiers exist, e.g. Sentry Developer or self-hosted GlitchTip **(verify)**                                                                                                           | Good: manual, previewed, already redacted twice                                                                                            | Already in place: user clicks Send per report                                    | Extend: make `FEEDBACK_API_URL` a build constant, or gate Send behind a tmwk flag. One line each in 2–3 files                                                                            |
| **D. Self-hosted analytics**        | PostHog self-hosted on the homelab, Orca's client pointed at it with a tmwk key                                                                                   | Hardware already owned. PostHog's hobby deploy wants about 4 vCPU / 16 GB **(verify)**. `pve` has 8 cores and 31 GB, with about 11 GB free today and three VMs running. Upkeep (ClickHouse, Kafka, upgrades) is the real cost | Good if only tmwk sees it. A public beta needs a public ingest URL into the homelab (Tailscale Funnel or a Cloudflare Tunnel) **(verify)** | Inherits Orca's opt-out default and banner text, which tmwk would need to reword | Extend: make the PostHog `host` a build constant (`posthog-transport.ts:82`). The key is already one. tmwk events would need new schemas in Track files, or a parallel tmwk client (Own) |
| **E. Hosted analytics**             | PostHog Cloud with a tmwk project                                                                                                                                 | Free tier around 1M events/month **(verify)**. Fine for a beta                                                                                                                                                                | Data at a third party. Same `disableGeoip`, no person profiles                                                                             | Same as D                                                                        | Same Extend as D. Least work if analytics is ever needed                                                                                                                                 |

Notes that apply across options:

- **Orca's catalog is Orca's.** Even with a tmwk key, D and E would send Orca's 111 events
  (onboarding funnels, feature-wall clicks, star nag). tmwk would get Orca's questions, not its
  own. Adding tmwk events means editing `telemetry-event-registry.ts` (Track, high churn) or
  writing a small tmwk client (Own) that shares the consent store. Either way it's real work for
  data nobody has asked for yet.
- **The Privacy switch.** It shows today and reads `optedIn: true` for new installs, but tmwk
  sends nothing. It promises something that isn't happening, and links to Orca's policy.
  Decided: leave it as is until the beta. At the beta it drives tmwk's own PostHog, and its link
  points to a tmwk privacy page.
- **Homelab.** `pve` is not public and collects no reports, so option D and a homelab error
  tracker are out. Option E (PostHog Cloud) is the chosen path.

## Keeping v0 off safely

### What the release build must do

1. **Never set Orca's** `ORCA_POSTHOG_WRITE_KEY` or `ORCA_DIAGNOSTICS_TOKEN_URL`. In v0 the tmwk
   release script `unset`s both before `pnpm run build:release`, because
   `electron.vite.config.ts:36-45` reads them from whatever shell runs the build. A stray export
   would bake a key in. From stage 3 on, the script sets `ORCA_POSTHOG_WRITE_KEY` to **tmwk's**
   key, read from the MacBook Air's login keychain, and never Orca's. Releases build and sign
   on the Air, not the MBP ([local-ci-plan.md](local-ci-plan.md) decision 5).
2. **Set `ORCA_BUILD_IDENTITY=stable`** (decided; S22 amended to match, as
   [local-ci-plan.md](local-ci-plan.md) step 5 already has it).
   - PostHog stays off in v0, since it also needs the write key (`client.ts:35-38`).
   - With identity set, the diagnostics endpoint is pinned to the build constant (`null`), and a
     runtime `ORCA_DIAGNOSTICS_TOKEN_URL` can't override it
     (`diagnostic-upload-endpoint.ts:19-30`). Unset, that env var would turn on upload to
     whatever URL it names.
   - Its only other readers are `client.ts` and the CI-only `release-javascript-artifact.mjs`.
3. **Feedback, crash and language-request forms: copy and open a GitHub issue** (decided). In v0
   nothing posts to `orca.dev`. Send becomes "copy the report and open a new issue on
   `tmwkdev/tmwk-app`", with the report text on the clipboard and a prefilled title. The crash
   copy text already exists (`reports/crash-report-copy-text.ts`).
   - It's an Extend, logged in the patch log, on `FEEDBACK_API_URL` (`feedback-request.ts:9`)
     and the three Send buttons (`SidebarFeedbackDialog.tsx:153`, `LanguageRequestForm.tsx:44`,
     `CrashReportDialogSurface.tsx:136`).
   - Built in [PR #59](https://github.com/tmwkdev/tmwk-app/pull/59), which also adds the
     inverted release check (`config/tmwk/release/verify-tmwk-no-telemetry.mjs`). This doc
     doesn't change app code.
4. **Don't run upstream's `verify-telemetry-constants.mjs`.** With `TELEMETRY_ENABLED = true` in
   source, it requires a `phc_` key and a `stable|rc` identity in every `app.asar`, and exits 1
   otherwise
   (`config/scripts/desktop-build/telemetry-contracts/verify-telemetry-constants.mjs:50-63`,
   `:78-126`). local-ci-plan step 10 lists it. Replace it with a tmwk check (Own, under
   `config/tmwk/release/`) that asserts the opposite.
   - The local CI plan's A7 instead sets `TELEMETRY_ENABLED = false` in packaged tmwk. Upstream's
     script then skips its check and passes (`:57-63`), so it proves nothing either way. Keep
     the tmwk check regardless. Stage 3 sets the flag back to `true`.

### How to verify

- **In the artifact.** The inverted check reuses upstream's patterns
  (`telemetry-bundle-constant-patterns.mjs`) and the same asar walk. For every
  `dist/**/app.asar`, it fails if `out/main/**/*.js` contains a `phc_…` key (`WRITE_KEY_RE` /
  `MINIFIED_TELEMETRY_RE`), or the literal `orca.dev/diagnostics`. Once item 3 lands, it also
  fails on `orca.dev/v1/feedback` as a live constant.
  - Note: `us.i.posthog.com` may still appear as dead code, because the host is a literal in
    `createPostHogClient`. Check for the key, not the host.
- **On the wire.** This is the smoke test already in the side-by-side guide's done-when
  (`side-by-side-install-guide.md:324`). Run the installed build behind a proxy, or watch it
  with Little Snitch / LuLu / `nettop`. Open the app, run a turn, open Settings → Privacy, and
  quit (quit flushes held events, `client.ts:329-345`). Expect no requests to
  `us.i.posthog.com`, `orca.dev/diagnostics`, or `orca.dev/v1/feedback`.
- **Belt and braces.** The tmwk launcher or LaunchAgent can export `DO_NOT_TRACK=1`, which
  disables PostHog and diagnostics upload at runtime (`consent.ts:53`, `observability/index.ts:83`)
  without touching code. Apps launched from the Dock don't inherit shell env **(verify)**, so
  don't rely on it alone.

## Stages

The owner accepted these stages. Nothing sends to Orca at any stage.

1. **v0: nothing off the machine.** Do the four items in
   [What the release build must do](#what-the-release-build-must-do). The forms open GitHub
   issues instead of posting. Until the patch ticket lands, S22 is not fully true: a user clicking
   Send on a crash report reaches Orca.
2. **Next: local-only (option B).** This is where tmwk's own questions get answered, at no cost
   and with no consent UX.
   - Record rollover, summary, main-session and ticket-refresh failures as spans in the
     existing local trace.
   - Show a small health view in tmwk: last failures, rollover count, ticket outcomes.
   - All Own code, no Track edits. This fits the product goal: Orca's power underneath, with
     tmwk simply telling the owner what happened.
   - **Built (2026-11-20).** `recordTmwkFailure` (`src/main/tmwk/health/record-tmwk-health.ts`)
     logs, writes a failed `tmwk.<kind>` span through `startSpan`, and keeps the failure in
     `store/health.json` (last 50; a repeat of the newest failure folds into it as `repeats`).
     Kinds: `rollover` (automatic check, queued rollover, turn wait), `summary` (refresh,
     fallback), `main-session` (create, replace, brief, bootstrap), `ticket-refresh`. A finished
     rollover is a `tmwk.rollover` span plus an entry with how the summary stood (`stored`,
     `fallback`, `stale`; last 200). The trace stays the record; the store copy exists because
     the trace is off in CI and under `ORCA_DIAGNOSTICS_DISABLED`, and rotates away.
   - The view is the **Health** button in the Chat header (`main-chat/health/`), reading
     `tmwk.health` from the home host: the last 5 failures, rollovers and ticket outcomes over
     7 days. Ticket outcomes count each ticket once by its latest attempt, the H1 rule in
     [ticket-history-plan.md](ticket-history-plan.md#counting)
     (`tickets/ticket-outcome-counts.ts`, for H1 to reuse). Screenshots in
     [`telemetry/stage2/`](telemetry/stage2/).
3. **tmwk's PostHog project (option E).** The owner is signing up for PostHog Cloud. Once the
   project exists:
   - **Key.** tmwk's own write key, kept in the **MacBook Air's login keychain** beside the
     signing secrets. Use service `dev.tmwk.release` and account `ORCA_POSTHOG_WRITE_KEY`, the
     same pattern as [local-ci-plan.md](local-ci-plan.md)'s secrets table. The release script
     on the Air reads it with
     `security find-generic-password -s dev.tmwk.release -a ORCA_POSTHOG_WRITE_KEY -w` and
     injects it at build time as `ORCA_POSTHOG_WRITE_KEY`, into the release process only. The
     MBP's nightly never has it, so nightly builds send nothing. Never Orca's key.
   - **Events.** tmwk's own small list, not Orca's 111: app opened (version, for update
     adoption), crash and error reports (enum class and count, from the crash store and the
     stage 2 failure spans), ticket outcomes (done, failed, abandoned, stalled), rollover and
     fallback-summary counts. Orca's catalog stays unsent. That needs either a tmwk client in
     Own code sharing Orca's consent store, or an Extend that drops Orca's events when the key
     is tmwk's **(verify** which is smaller when the stage starts**)**.
   - **Host.** `us.i.posthog.com` is hard-coded (`posthog-transport.ts:82`). It's the same
     PostHog Cloud host, so tmwk can keep it if its project is in the US region **(verify** the
     region at sign-up**)**. Otherwise an Extend makes it a build constant.
   - **Consent.** Match Orca: opt-out, sending automatically for new installs
     (`loaded-cohort-migrations.ts:180-185`). The Privacy switch then drives tmwk's PostHog, and
     links to a tmwk privacy page instead of `orca.dev/docs/telemetry`.
   - **Verify.** Replace stage 1's "no `phc_` key" check with "the key is tmwk's". Compare a
     hash of the key, as upstream's `release-javascript-artifact.mjs:85` does.
   - **Diagnostics.** The bundle upload stays off. Error reports go through PostHog, and
     anything a user wants to send by hand goes to a GitHub issue.
4. **Deferred: Orca's other GETs.** Changelog, update nudge, and plugin kill-list and stats
   ([section 7](#7-other-calls-to-orcas-servers-not-telemetry)) stay as they are for now.
   - The side-by-side guide's P5 already plans to turn off the nudge and changelog URLs in
     packaged tmwk (`side-by-side-install-guide.md`, P5). Pick up the plugin lists with them, or
     in a ticket after the beta.
   - Decide per call: turn off, point at a tmwk URL, or keep. The kill list is a safety feature,
     so keeping it may be right.

Before stage 3, nothing is public except GitHub issues. The homelab is not public and collects
no reports.

## Decisions

The owner's answers to this plan's open questions, 2026-11-20:

| #   | Question                                           | Decision                                                                                                                  |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ORCA_BUILD_IDENTITY` in release builds            | Set `stable`. S22 amended to match.                                                                                       |
| 2   | Feedback, crash and language-request forms in v0   | Copy the report and open a GitHub issue on `tmwkdev/tmwk-app`. Nothing posts to `orca.dev`. Patched by a separate ticket. |
| 3   | Privacy telemetry switch                           | Leave as is until the beta.                                                                                               |
| 4   | Orca's other GETs (changelog, nudge, plugin lists) | Leave for now; [stage 4](#stages) handles them.                                                                           |
| 5   | Consent default once tmwk sends                    | Match Orca: opt-out, sending automatically once tmwk's own PostHog is set up.                                             |
| 6   | Homelab                                            | Not public; collects no reports. Anything public before PostHog goes to GitHub issues.                                    |
| —   | Analytics and error reporting backend              | tmwk's own PostHog Cloud project (stage 3), not a homelab tracker.                                                        |
