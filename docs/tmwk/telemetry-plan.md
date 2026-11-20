# Telemetry plan

Status: investigation and recommendation, for the owner to decide. Docs only.

The v0 decision is already made: **telemetry is off.** tmwk never sends to Orca's PostHog or
Orca's diagnostics endpoint ([side-by-side guide](side-by-side-install-guide.md) S22;
[local-ci-plan.md](local-ci-plan.md) release decision 4). This doc covers what Orca collects
today, what tmwk would want to learn, the options, how to keep v0 off safely, and a
recommendation.

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
  server when the user clicks Send. S22 does not cover this today. Closing it needs a small
  Extend (see [Keeping v0 off](#keeping-v0-off-safely)).
- `verify-telemetry-constants.mjs`, which the local release plan runs at step 10, **fails** on a
  build with no write key. tmwk needs its own inverted check instead.
- Recommendation: send nothing in v0. Make tmwk's own failures visible **on the owner's
  machine** first, reusing Orca's local trace file. For the public beta, add opt-in crash and
  error reports to a tmwk endpoint. Add product analytics only when a specific question needs
  it.

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
version. They also show Orca content. They are outside S22, and are listed here so a later
ticket can decide on them:

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
  sends nothing. It promises something that isn't happening, and links to Orca's policy. For v0
  that's harmless. Before the beta, it should either be hidden (Extend on `PrivacyPane.tsx`) or
  wired to whatever tmwk actually sends, with a tmwk privacy page.

## Keeping v0 off safely

### What the release build must do

1. **Never set** `ORCA_POSTHOG_WRITE_KEY` or `ORCA_DIAGNOSTICS_TOKEN_URL`. The tmwk release script
   should `unset` both before `pnpm run build:release`, because `electron.vite.config.ts:36-45`
   reads them from whatever shell runs the build. A stray export would bake a key in.
2. **`ORCA_BUILD_IDENTITY` needs a decision.** The docs disagree:
   - S22 says leave it unset.
   - [local-ci-plan.md](local-ci-plan.md) step 5 sets `ORCA_BUILD_IDENTITY=stable`.
   - Either way, PostHog stays off, since it also needs the write key (`client.ts:35-38`).
   - The difference is diagnostics. With identity **set**, the endpoint is pinned to the build
     constant (`null`), and env can't override it. With identity **unset**, a runtime
     `ORCA_DIAGNOSTICS_TOKEN_URL` in the user's environment enables upload to that URL
     (`diagnostic-upload-endpoint.ts:19-30`). It's only reachable by someone setting that env on
     purpose, and upload is still a manual click.
   - Setting it is the tighter choice for diagnostics. Its only other readers are
     `client.ts` and the CI-only `release-javascript-artifact.mjs`.
   - See open question 1.
3. **Close the feedback hole.** This is the one change needed for S22 to be true. It's a small
   Extend, logged in the patch log:
   - Turn `FEEDBACK_API_URL` (`feedback-request.ts:9`) into a build constant that defaults to
     `null`, and make Send unavailable when it is `null`.
   - Or gate the three Send buttons on a flag like `TMWK_SHOW_UPSTREAM_COMMUNITY_LINKS`, and offer
     "Copy report" (already exists for crashes) plus "Open an issue on tmwkdev/tmwk-app".
   - This needs app code, so it's a follow-up ticket, not part of this doc.
4. **Don't run upstream's `verify-telemetry-constants.mjs`.** With `TELEMETRY_ENABLED = true` in
   source, it requires a `phc_` key and a `stable|rc` identity in every `app.asar`, and exits 1
   otherwise
   (`config/scripts/desktop-build/telemetry-contracts/verify-telemetry-constants.mjs:50-63`,
   `:78-126`). local-ci-plan step 10 lists it. Replace it with a tmwk check (Own, under
   `config/tmwk/release/`) that asserts the opposite.

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

## Recommendation

1. **v0: nothing off the machine.** As decided. Do the four items above. Item 3, the feedback
   gate, is the only code change, and it's an Extend of a few lines. Until it lands, S22 is not
   fully true: a user clicking Send on a crash report reaches Orca.
2. **Next: local-only (option B).** This is where tmwk's own questions get answered, at no cost
   and with no consent UX. Record rollover, summary, main-session and ticket-refresh failures as
   spans in the existing local trace. Show a small health view in tmwk: last failures, rollover
   count, ticket outcomes. All Own code, no Track edits. This fits the product goal: Orca's power
   underneath, with tmwk simply telling the owner what happened.
3. **Public beta: crash and error reports only (option C), opt-in, per report.** Start with
   "copy report + open GitHub issue", which needs no infrastructure. Move to a tmwk endpoint
   (GlitchTip on the homelab, or a hosted tracker) only if issue volume makes that painful.
   The redaction, preview and per-report consent already exist in Orca's code.
4. **Product analytics: not yet.** Revisit when there is a question crash reports and the local
   view can't answer, such as "do beta users finish tickets?". Then choose between E (least work)
   and D (keeps data home), with tmwk's own small event list, not Orca's 111. Self-hosted
   PostHog on `pve` is possible but would take most of its free memory **(verify)**.

## Open questions for the owner

1. **Build identity.** Set `ORCA_BUILD_IDENTITY=stable` in the release build (tighter:
   diagnostics endpoint can't be overridden by env) as local-ci-plan step 5 has it, or leave it
   unset as S22 says? Recommended: set it, and amend S22.
2. **Feedback in v0.** Hide Send on the feedback, crash and language-request forms, or turn it
   into "copy + open a GitHub issue on tmwkdev/tmwk-app"? Recommended: copy + open issue.
3. **Privacy switch.** Hide Settings → Privacy's telemetry switch in v0, or leave it until the
   beta? It defaults to on and does nothing.
4. **Orca's other GETs** (changelog, nudge, plugin lists). Leave them, or point or turn them off
   in a later ticket? They carry no install ID, but they show Orca's content in tmwk.
5. **Beta consent default.** If tmwk ever sends anything automatically, opt-in (tmwk's choice)
   or opt-out (Orca's default for new installs)? Recommended: opt-in.
6. **Homelab exposure.** Is a public ingest URL into `pve` acceptable for a beta, or should
   anything public be hosted elsewhere?
