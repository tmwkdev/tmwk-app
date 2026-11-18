# M1 implementation guide: main home and main view

This guide turns the M1 row of [main-chat.md](main-chat.md#milestones) into build steps. It was
written on 2026-11-17 from a read of the code on `tykowale/m1` (base `7656566a2f4`), the
[M0 findings](main-chat.md#m0-findings), and a study of how OpenClaw builds its main agent.
Every code reference was found by reading the code. Items marked **(verify)** were not run and
must be checked before they are relied on.

**Done when:**

- the pinned main session is created on the home host;
- the `'main'` view is the launch default;
- the partner follows the inline-or-delegate rules;
- the import-boundary gate from [fork-ownership.md](fork-ownership.md#guardrails) is landed.

## What changes from main-chat.md

Fold these into main-chat.md when M1 lands. The behavior change is already in it (see
[Doc updates](#doc-updates)).

1. **No hard tool fence to start.** The partner works by the spirit of the law, not a permission
   list. It does trivial work and work the user implies should happen inline. That includes MCP
   and CLI calls, such as "pull up this Slack thread: is it a worthwhile ticket?". Everything
   else becomes a ticket. A fence blocks exactly that kind of inline work, and was the most
   fragile part of M1: Claude folder trust, per-agent allow/deny files, an unverified Codex rules
   path, and a permission-pin patch inside native chat. All of that is dropped, and so is any
   permission-mode handling: the main session runs like any other chat in Orca, with the user's
   own permission mode and agent configuration. What the
   investigation learned is kept under [If a fence comes back](#if-a-fence-comes-back).
2. **The partner prompt is agent-neutral.** M1 does **not** append to Claude's `claude_code`
   preset. One tmwk-owned builder renders the prompt, and a small transport per agent delivers
   the same text (see [W2](#w2-partner-prompt-builder-and-transports)). No Track edit to
   `src/main/claude/**` is needed. Without a fence, every agent Orca runs as a structured chat is
   eligible, Pi included.
3. **The ownership map is wrong about the `'main'` view.** It is not only a `store/slices/ui`
   patch: `TopLevelView` and its validators live in Track files under `src/shared/`. Host startup,
   resource packaging and the gate also touch Track paths.
   [Ownership changes](#ownership-changes) lists every row to add before code lands.

## Decisions

Decided 2026-11-17. Record them in the fork-ownership decision log. There is no permission-mode
decision: tmwk passes no mode and writes no permission files.

| #   | Decision                                    | Outcome                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How a host knows it is the home host.       | `TMWK_HOME_HOST=1` in the host's environment marks it home. A homelab sets it in its `orcad` service env. The desktop app is home when it is not attached to a remote home. A desktop attached to a remote home never bootstraps its own main session. Nothing in Orca models this today.                                                               |
| D2  | Whether `'main'` is the launch view always. | **Always**, applied on the startup hydrate only. The user lands on the main chat each time, and every other view is one click away. It is a one-line Extend change (see [W5](#w5-main-view)).                                                                                                                                                           |
| D3  | Whether the crew panel is part of M1.       | **No.** It is hard-disabled (`useOrchestrationPanelEnabled()` returns `false` after performance regressions) and is per session rather than per Run. The partner answers "what is running" through the CLI. An Own ticket list goes in M2 or M4.                                                                                                        |
| D4  | Which agent the main session uses.          | **Orca's default agent setting**, `defaultTuiAgent` (Settings, "New-workspace agent"). Resolve it the way Orca does for a new workspace (`resolveWorktreeStartupDraftAgent`, `runtime-worktree-agent-startup.ts:58`): the setting if it names an enabled agent, else the first agent detected on the host (`pickTuiAgent`). See [W4](#w4-main-session). |

## Inline or delegate

This is the partner's behavior contract that replaces the fence. It goes into
`resources/tmwk/main-partner.md` (W2) and into main-chat.md's "Behavior" section.

**Do it inline** when the work is quick, and either read-only or clearly meant to happen in the
chat:

- conversation, and what the partner already knows;
- lookups: files in a registered project, `orca` state, and anything an MCP server or CLI the
  user has set up can fetch, such as a Slack thread, an issue, a PR or a doc;
- judging or summarizing what it fetched ("is this worth a ticket?");
- a small action the user asked for in so many words, such as "reply 'on it' in that thread".

**Delegate** everything else:

- any change to a project: files, branches, commits or PRs, however small. Changes get a
  worktree, an owner and a report;
- anything that takes more than a few quick calls, or that the user would want to follow or
  come back to;
- anything that needs a build, a test run or a long-running process.

**Confirm first** before an outward-facing or hard-to-undo action the user did not name exactly,
inline or delegated. That covers posting, commenting, sending, merging and deleting.

**Stay out of owners' way:** never act inline on work a running ticket owns. Send it to that
owner instead.

The tradeoff is that nothing enforces this. Dogfooding is the test: if the partner overreaches,
tighten the prompt first, then consider an opt-in fence.

## Agent matrix

How the prompt reaches each agent Orca runs as a structured chat.

| Agent                                              | Prompt transport                                                                                        | Notes                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Claude                                             | `CLAUDE.md` in the main home, loaded through the `project` setting source                               | M0 confirmed.                                                                    |
| Codex                                              | `AGENTS.md` in the main home. Its per-turn instruction field is forced to `null` in collaboration mode. | M0 confirmed.                                                                    |
| Antigravity                                        | `AGENTS.md`, which Orca itself adds to the session's `_meta` append                                     | **(verify)**                                                                     |
| Grok, OpenCode, OMP, Cursor, Copilot, Hermes, Kimi | Native `AGENTS.md` reading is unverified, so fall back to the first-turn prompt                         | **(verify)** one ACP agent end to end in M1                                      |
| Pi                                                 | First-turn prompt                                                                                       | Structured Pi is always full access (`src/main/pi/rpc/launch/rpc-launch.ts:61`). |

The main session runs in `~/.tmwk/main` with the user's own agent configuration. Claude loads
the `user` setting source, so the user's MCP servers and `~/.claude` settings apply. Codex loads
the user's `config.toml`. tmwk adds no MCP servers. Whether the Slack example works is up to
what the user has connected.

## Ownership changes

Land these map rows, patch-log lines and a decision-log line in the same PR as the code they
cover.

| Path                                                                                | From  | To     | Why                                                                                      |
| ----------------------------------------------------------------------------------- | ----- | ------ | ---------------------------------------------------------------------------------------- |
| `config/ast-grep/rules/tmwk-*`, `config/ast-grep/rule-tests/tmwk-*`                 | Track | Own    | The import-boundary gate. New files only.                                                |
| `src/main/startup/runtime-startup/chat-journal-startup.ts`                          | Track | Extend | One line: start the tmwk home bootstrap on the Electron host (desktop and `orca serve`). |
| `src/main/backend/core-runtime-activation.ts`                                       | Track | Extend | One line: the same on the Node `orcad` host.                                             |
| `config/electron-builder.config.cjs`                                                | Track | Extend | Ship `resources/tmwk` as an extra resource, and exclude it from `files`.                 |
| `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`                   | Track | Extend | Copy `resources/tmwk` into the orcad bundle. Without it an orcad home has no prompt.     |
| `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts` | Track | Extend | Add `'main'` to `TopLevelView` and its exhaustive lookup.                                |
| `src/shared/rpc-contract/client-ui/client-ui-params.ts`                             | Track | Extend | Add `'main'` to `TopLevelViewSchema`, then regenerate the RPC params catalog.            |
| `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts`  | Track | Extend | Suppress the right sidebar on the main view.                                             |

`src/renderer/src/store/slices/ui/**`, `src/renderer/src/app-shell/**` and
`src/renderer/src/components/sidebar/chrome/**` are already Extend.

Not touched in M1: `src/main/native-chat/**`, `src/main/claude/**`, `src/main/codex/**`,
`src/main/acp/**`, `mobile/**`, `src/cli/specs/**`, the RPC method registry, and
`src/main/runtime/orchestration/**`.

## Build order

W1 lands with the first Own file. W2 and W3 can proceed in parallel, then W4 and W5. Spike the
W5 chat mount early, because it is the least proven piece.

### W1. Import-boundary gate

Use a new ast-grep rule. It needs no edit to an existing file, and `pnpm lint`,
`pnpm check:changed` and CI (`.github/workflows/pr.yml`, "Enforce ast-grep rules") already run
every rule in `config/ast-grep/rules/`.

`config/ast-grep/rules/tmwk-no-orchestration-internals.yml`, with a `tsx` twin document as the
other rules have (rule ids are per language, see `config/sgconfig.yml`):

```yaml
# Own tmwk code reaches orchestration only through the orca CLI or runtime RPC (docs/tmwk/fork-ownership.md).
id: tmwk-no-orchestration-internals
language: typescript
severity: error
message: tmwk-owned code must not import src/main/runtime/orchestration. Call the `orca` CLI or runtime RPC instead.
files:
  - src/main/tmwk/**
  - src/cli/tmwk/**
  - src/shared/tmwk/**
  - src/renderer/src/components/main-chat/**
rule:
  all:
    - kind: string_fragment
    - regex: '(^|/)runtime/orchestration(/|$)'
    - inside:
        stopBy: end
        any:
          - kind: import_statement
          - kind: export_statement
          - pattern: import($$$)
          - pattern: require($$$)
          - pattern: vi.mock($$$)
---
id: tmwk-no-orchestration-internals-tsx
language: tsx
# identical severity, message, files and rule
```

The regex catches relative (`../runtime/orchestration/x`, `../../main/runtime/orchestration/x`)
and bare `src/main/runtime/orchestration/x` specifiers. It does not catch
`shared/orchestration` or `runtime/orchestration-handlers`. Only `@/` and `@renderer/` aliases
exist, and both point into the renderer, so no alias form can reach main code.

Add `config/ast-grep/rule-tests/tmwk-no-orchestration-internals-test.yml` in the format of
`no-eager-qrcode-import-test.yml`:

- **valid:** a `../../shared/orchestration/...` import and a `../runtime/orchestration-handlers` import.
- **invalid:** static import, `import type`, `export * from`, `import()`, `require()`, and the bare `src/main/...` form.

Sequencing and proof:

- **Land it with the first tracked file in each listed directory.** The path-literal ratchet
  (`check-path-literal-ratchet.mjs`) rejects `files:` globs that name untracked directories
  **(verify)**. If a directory stays empty in M1, such as `src/cli/tmwk/`, drop it from `files:`
  until it exists.
- **`ast-grep test` ignores `files:`**, so it cannot prove the path scoping. Prove it once with a
  throwaway `src/main/tmwk/gate-probe.ts` importing `../runtime/orchestration/db/store`. Run
  `pnpm lint:ast-grep-gates` and expect exit 1 with `error[tmwk-no-orchestration-internals]`. Then
  delete the probe. Never commit it.
- **Update the doc.** In fork-ownership.md "Guardrails", change "planned, not yet enforced" to
  enforced and name the rule id.

### W2. Partner prompt builder and transports

This follows OpenClaw: one pure builder renders the same text for every agent, and only the
delivery differs. OpenClaw does this with `buildAgentSystemPrompt` plus per-backend transports.

**Builder.** `src/main/tmwk/partner-prompt/render-partner-prompt.ts` is a pure function with
inputs `{ basePrompt, agent, homePath }` that returns one markdown string. It renders:

1. the static prompt from `resources/tmwk/main-partner.md`, with the HTML header comment stripped;
2. no date, host or ticket state.

Volatile state belongs in a turn (M3's briefing), not in a file read at spawn. That follows
OpenClaw's rule of stable text first, so the prompt stays byte-identical across days.

**Transports.** W3 writes both files on each launch, and only when the content differs:

- `~/.tmwk/main/CLAUDE.md`, for Claude;
- `~/.tmwk/main/AGENTS.md`, for Codex, Antigravity and other `AGENTS.md` readers.

Writing both means a later agent switch needs no migration. Do not also append the prompt to
Claude's preset, or Claude loads it twice.

For an agent with no verified file channel, the rendered prompt rides the session-create
`prompt` (see [W4](#w4-main-session)). This is how Orca already briefs its own workers
(`worker-dispatch-preamble.ts`). It is visible in the transcript and is not re-sent on resume,
so it is the fallback, not the default.

**Prompt edits** in `resources/tmwk/main-partner.md`:

- **Header comment:** M1 delivers the prompt as workspace files, not as a preset append.
- **Replace the fence language with [Inline or delegate](#inline-or-delegate).** Drop "It is the
  only shell command you run" and "You never edit files". Drop the no-pipes, no-heredocs rule
  too: it existed only because the fence could not vet them (M0 finding 3). Keep "one plain
  command at a time" as advice.
- **Agent-neutral wording:** "Read, Glob and Grep" becomes "your file and lookup tools".
- **Projects:** ignore any repo with `hiddenAt` set, and the tmwk home itself. `repo list --json`
  still returns the hidden `tmwk main` row.
- **Command name:** always type the bare word `orca`. Never write `orca-ide`, `orca.cmd` or
  `orca-dev`.
- **Borrowed from OpenClaw:**
  - "An owner finishing is the end of that run, not proof the goal is met."
  - When a correction is sent with `send`, say it was delivered to the owner, not that the owner
    acted on it.
- **Keep the Run rule:** the partner checks the Run named `main` before its first orchestration
  command and recreates it if missing. Orca refuses to bind a Run to a chat from any caller
  other than the chat itself (`orchestration-party.ts:110-123`), so Own code cannot do it.

### W3. Main home bootstrap

All files are Own, under `src/main/tmwk/main-home/`. Use `fs/promises` only: the
`check:main-sync-fs-ratchet` rejects new `*Sync` calls. Keep files under 300 lines.

**Paths** (`main-home-paths.ts`):

- **Root:** `TMWK_HOME` if set and absolute. Otherwise `<home>/.tmwk`, where `<home>` is
  `process.platform === 'win32' ? env.USERPROFILE : env.HOME`, falling back to
  `getAppEnvironment().getPath('home')`. This matches `claude-folder-trust-file.ts`.
- **Dev and E2E:** when `!getAppEnvironment().isPackaged()` or `ORCA_E2E_USER_DATA_DIR` is set,
  and `TMWK_HOME` is unset, default to `<userData>/tmwk`. Dev `userData` is already per worktree,
  so a dev instance never touches the real `~/.tmwk`. Nothing isolates `HOME` in dev today.
- **Never under a Claude Code scratchpad.** A `CLAUDE.md` inside a session scratchpad is never
  loaded (M0 note).
- **Main home:** `<root>/main`. Create it with mode `0o700` on POSIX.

**Resources** (`main-home-resources.ts`): locate `resources/tmwk`. Copy the candidate order from
`native-chat-visuals-skill-location.ts` (`candidatePluginDirs`):

1. `process.resourcesPath/tmwk`
2. if packaged, `getAppPath()/tmwk`
3. in dev, `getAppPath()/resources/tmwk`
4. `cwd/resources/tmwk`

If `main-partner.md` is missing, log loudly and refuse to create the session. Do not delete
existing copies. This depends on the two packaging Extend patches:

- `config/electron-builder.config.cjs`: add `{ from: 'resources/tmwk', to: 'tmwk' }` to
  `commonExtraResources`, and `'!resources/tmwk/**'` to `files`, mirroring `native-chat-visuals`.
- `build-orcad.mjs`: add `cpSync(join(ROOT, 'resources', 'tmwk'), join(OUT_DIR, 'tmwk'), { recursive: true })`
  beside the existing `native-chat-visuals` copy.

**Bootstrap** (`ensure-main-home.ts`): `ensureTmwkMainHome(runtime)`. It is idempotent, memoized
per runtime, and logs and continues on each step's failure, so a bad home never blocks host
startup.

1. Resolve paths and create the folders.
2. Write the W2 transports, each through `writeFileAtomically`
   (`src/main/filesystem/atomic-file-publication.ts`) and only when the content differs.

3. Register the workspace with `runtime.addRepo(main, 'folder', undefined, 'tmwk main')`, then
   `runtime.setRepoHidden('id:' + repo.id, true)`. Both are idempotent, and lookup finds hidden
   rows. Use `repo add --kind folder`, as M0 did, not `folderWorkspace.create`, which needs a
   project group.
4. Return `{ repoId, worktreeId: getRepoMainWorktreeId(repo), paths }` for W4.

There is no trust or permission step. Trust mattered only so Claude would honor a project
`permissions.allow` (M0 finding 1), and nothing like that ships. `CLAUDE.md` loads in an
untrusted folder.

**Host hook** (`start-main-home.ts`, plus two Extend lines). `startTmwkMainHome(runtime)` checks
the home-host predicate (D1, `home-host.ts`) and returns the memoized promise:

- **Electron** (desktop and `orca serve`): inside `chatJournalHostServing`'s `.then`, next to
  `reclaimManagedRuntimeReleasesAtLaunch(state.runtime)`, add `void startTmwkMainHome(state.runtime)`.
  It runs after the first-window fence.
- **orcad:** in `activateBackendRuntime`, after `reclaimManagedRuntimeReleasesAtLaunch(runtime)`,
  add `(await import('../tmwk/main-home/start-main-home')).startTmwkMainHome(runtime)`. That
  matches the lazy-import style there.

The orcad path can only be exercised after `pnpm build:orcad`, because a dev checkout has no
orcad template.

### W4. Main session

All Own, under `src/main/tmwk/main-session/`.

**In-process RPC.** Create through the same RPC every client uses, so remote homes behave like
local ones. Copy `pluginRuntimeRpc` (`src/main/plugins/runtime/plugin-runtime-rpc.ts:22-70`):
`new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS })` with caller `{ kind: 'local-cli' }`.
Its use on orcad is **(verify)**; it is used only in Electron main today. Importing
`ALL_RPC_METHODS` is not an orchestration import, so the gate allows it.

**Pin record.** `~/.tmwk/main-session.json` holds `{ sessionId, agent, createdAt }`. Its type lives
in `src/shared/tmwk/main-session-record.ts`. This file is the pin. Orca's journal already persists
the session and resumes it across restarts, because the Claude provider id is derived from the
Orca id (`claude-structured-session-id.ts`). So tmwk only maps "main" to a session id.

**`ensureMainSession`**, called at the end of the W3 bootstrap:

1. Read the pin. If there is none, mint an id (`createOrcaSessionId`) and pick the agent (D4):
   - read `defaultTuiAgent` and `disabledTuiAgents` from the home host's settings;
   - reuse Orca's resolution order rather than re-implementing it. Either call
     `resolveWorktreeStartupDraftAgent` with the main repo, or compose `pickTuiAgent`
     (`src/shared/agent-launch/catalog/tui-agent-selection.ts:57`) with host detection;
   - treat `'blank'` (no agent) as "use the first detected agent", because the main chat needs one;
   - skip agents that cannot run as a structured chat **(verify)**: `defaultTuiAgent` is a
     terminal-agent id, and not every one has a native chat adapter.
2. Call `agent.launch` with:

   ```ts
   {
     agent,
     target: { kind: 'existing', worktree: `path:${main}` },
     surface: 'chat',
     presentation: 'background',
     launchSource: 'tmwk',                    // (verify) accepted value; else 'cli'
     sessionId,
     chatOptions: { model, effort },          // only when the user picked them
     prompt: needsFirstTurnPrompt(agent)      // only for agents with no file channel
       ? { text: renderedPrompt, delivery: 'submit' }
       : undefined
   }
   ```

   No permission mode is passed: the session gets the user's chat default, like any other chat.

3. Treat `agent_session_conflict` (`AgentLaunchSessionAlreadyExistsError`) as "already exists".
   If the pin exists but the record is gone (profile reset), launch with a fresh id, overwrite
   the pin, and log it.

**One session per main home.** Nothing in Orca refuses a second chat in a workspace.

- The caller-minted `sessionId` makes a repeated `ensureMainSession` safe.
- The hidden repo keeps the main home out of every list that offers "new chat".
- For strays, such as a CLI `agent launch --worktree path:~/.tmwk/main`, add an Own reconciler
  that lists sessions in the main workspace (`session.tabs.list { worktree }`) and closes any id
  other than the pinned one (`agentSession.close`).
- A hard refusal at create time would be a Track edit to `agent-launch`. Add it only if the
  reconciler proves insufficient.

**Run `main`.** Leave Run creation to the partner (W2 prompt rule). Runs are deleted after 24 h
settled with no live coordinator, so the partner recreates `main` lazily on its first
orchestration command. No start turn is needed, which saves a model turn per cold start.

### W5. Main view

**Type and validators.** These are compile-forced, so land all four together:

- `src/shared/ui-chrome/ui-chrome-types.ts`: add `| 'main'`.
- `src/shared/ui-chrome/top-level-view.ts`: add `main: true`. The lookup is exhaustive, and a
  missing entry makes persistence silently fall back to `'terminal'`.
- `src/shared/rpc-contract/client-ui/client-ui-params.ts`: add `'main'` to the enum, then run
  `pnpm generate:rpc-params-catalog`.
- `right-sidebar-visibility.ts`: add `'main'` to `RIGHT_SIDEBAR_SUPPRESSED_VIEWS`.

**UI slice** (Extend):

- Add `'main'` to `UiViewHistory`, with `previousViewBeforeMain`.
- Add `openMainPage` and `closeMainPage`, copying `openMobilePage` and `closeMobilePage`.
- Set the initial `activeView` to `'main'` (`ui-slice-task-actions.ts:17`).
- Make the sanitizer fall back to `'main'` (`ui-slice-hydration-sanitizers.ts:182`).
- For D2, on the startup hydrate (`ui-slice-hydration-actions.ts:280`) apply `'main'` instead of
  the persisted view.

Worktree activation already switches to `'terminal'`, so opening an owner's tab leaves the main
view with no extra code.

**Mount** (Extend, `AppWorkspaceShell.tsx`): one `lazy(() => import('../components/main-chat/MainChatView'))`
and one `ActivePage` line. The sidebar and titlebar stay visible for `'main'` with no change.

**Sidebar entry** (Extend, `SidebarNav.tsx`): one line, `<MainChatSidebarEntry />`, placed first
after `<SetupGuideSidebarEntry />`. The component is Own, in `components/main-chat/`.

- It copies the Artifacts button: `aria-current`, the `bg-worktree-sidebar-accent` active
  classes, and a lucide icon at `size-4`.
- It has no hide menu.
- Add the label to the locale files.

**`MainChatView`** (Own):

1. **Resolve the session by convention.** No new RPC; a `tmwk.*` RPC would need Track registry
   and catalog edits.
   - Find the repo in `repo.list` whose path is the main home.
   - Call `session.tabs.list { worktree }` and take the `agent-session` tab.
   - That gives `{ tabId, sessionId: tab.entityId, agent: tab.agentSessionAgent, worktreeId }`.

   Whether a background `agent.launch` creates that tab is **(verify)**. If it does not, create
   the tab with `agentSession.create` attach params.

2. **Render the chat.**
   - Render `NativeChatView mode="structured"` inside the same wrappers
     `StructuredAgentSessionPaneOverlayLayer.tsx:50-79` uses, minus `RetainedPaneHost`:
     `NativeChatPaneLifetime` > `NativeChatHostOutageOwner target` > `NativeChatComposerEditorOwner` > `ActivityPortalContainer`.
   - Pass `isVisible` and `isFocusedGroup` as true.
   - Use a `relative h-full min-h-0` container.
   - `target` comes from `structuredAgentSessionTargetForHost`, so a remote home renders the
     same way.

   No code mounts a structured chat outside the overlay layer today, so spike this first. The
   fallback is the `FloatingTerminalPanelSurface` pattern: `TabGroupSplitNodeTree` plus
   `WorkspacePaneOverlayLayers` for the main workspace id.

3. **States:** preparing, while the bootstrap is in flight; and home host unreachable. Follow
   `docs/STYLEGUIDE.md` tokens. Invent no colors.

The main home is a folder workspace. The view must never call git APIs for it.

### W6. Mobile

There is no mobile code in M1 (`mobile/**` is Track):

- The route `mobile/app/h/[hostId]/session/[worktreeId]` opens any workspace id, hidden or not.
- A desktop "Open on phone" or share link uses
  `/h/{hostId}/session/{worktreeId}?standalone=1&paneKey=<structuredAgentSessionPaneKey(tabId, sessionId)>`,
  resolved by the same convention as W5.
- The mobile Home active-agents feed has no hidden filter, so the main session also shows there.

Device testing stays **(verify)**. The spike had no paired phone.

## Tests

Add tests only where a revert would fail them, with hardcoded expectations. The rules are in
[test-antipatterns](../agents-md-refs/test-antipatterns.md).

| Test                                     | Layer and template                                                    | Fails if                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Bootstrap twice under a temp `TMWK_HOME` | Main unit, mkdtemp pattern of `claude-folder-trust-file.test.ts`      | Files are not rewritten when the resource changes, or the second run rewrites files whose content is unchanged. |
| `ensureMainSession` twice                | Main unit with a fake RPC client at the create entry point            | A second session is created instead of reusing the pin.                                                         |
| Gate                                     | `config/ast-grep/rule-tests/tmwk-no-orchestration-internals-test.yml` | Any import form slips through.                                                                                  |

Not added: a hydration test for `'main'`. Startup always applies `'main'` (D2), so it could not fail on a missing lookup entry. Do not test the default view value, prompt text, the sidebar label or entry count. The
inline-or-delegate behavior is proven in the runbook, not in unit tests.

## Validation runbook

This proves the done-when with screenshots, saved under `docs/tmwk/m1/` as M0's were. The
`$electron` skill is not in this repo, so the runbook uses the repo's own CDP attach pattern
(`tests/tools/benchmarks/workspace-switch-paint-latency.mjs`).

```sh
SCR=<a dir outside any Claude Code scratchpad>   # M0 note
mkdir -p "$SCR/ud" "$SCR/tmwk"
pnpm build:cli
env -i HOME="$HOME" USER="$USER" PATH="$PATH" ORCA_BACKGROUND_LAUNCH=1 \
  ORCA_DEV_USER_DATA_PATH="$SCR/ud" TMWK_HOME="$SCR/tmwk" \
  REMOTE_DEBUGGING_PORT=9455 ORCA_DEV_RENDERER_PORT=15455 \
  ORCA_SKIP_DEV_WEB_PREPARE=1 VITE_EXPOSE_STORE=true \
  pnpm dev > "$SCR/dev.log" 2>&1 &
```

`env -i` drops a parent dev Orca's ports and renderer URL (M0 note). `HOME` and `USER` stay real so agent
auth and the user's MCP servers work. Without `USER`, `claude auth status` reports signed out.

Attach with `chromium.connectOverCDP('http://127.0.0.1:9455')` and take screenshots from the
hidden renderer. Never call `show()` or `focus()`. Assert through the DOM, not `window.__store`.

| #   | Check                                | Evidence                                                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Fresh profile lands on the main view | `01-launch-main.png`; `ls -la $SCR/tmwk/main` shows `CLAUDE.md` and `AGENTS.md`                                                                                                |
| 2   | Main session exists and is pinned    | `02-main-session.png`; session id in `main-session.json` matches the tab's `entityId`                                                                                          |
| 3   | Inline lookup stays inline           | With an MCP or CLI source the user has connected: "pull up <thread or issue>: is this worth a ticket?" The partner fetches and judges, with no ticket (`03-inline-lookup.png`) |
| 4   | A change becomes a ticket            | "Rename `greet` to `hello` in the demo repo" creates a ticket and an owner. The partner does not edit (`04-delegates-change.png`)                                              |
| 5   | Outward action asks first            | "Let them know in the thread" (no exact text) gets a question or a draft, not a post (`05-asks-first.png`)                                                                     |
| 6   | Delegation loop still works          | The M0 scenario: `worker_done` wakes the partner and the report follows the rules (`06-report.png`)                                                                            |
| 7   | Restart keeps one session            | Kill the Electron pid, relaunch with the same env, compare session ids, and confirm a single `agent-session` tab in the main workspace (`07-after-restart.png`)                |
| 8   | A stray session is closed            | `orca-dev agent launch --worktree path:$SCR/tmwk/main …`, then relaunch; the reconciler closes it (`08-stray-closed.png`)                                                      |
| 9   | Codex and one ACP agent              | Repeat 3 and 4 with the pin's agent set to `codex`, then once with an ACP agent through the first-turn prompt.                                                                 |
| 10  | orcad home                           | `pnpm build:orcad`, run with `TMWK_HOME_HOST=1`, attach the desktop as a client, repeat 1–2 against the remote target. Mark **Not tested** if it cannot run.                   |

Checks 3–5 are judgment, not mechanism. Run each prompt twice. Record a miss as a prompt fix, not
a pass.

Teardown:

- kill the dev process by pid;
- `orca worktree rm` the owner worktrees (they land under `~/orca/workspaces/<repo>/`);
- `rm -rf "$SCR"`.

Before push, run `pnpm check:changed`, `pnpm test:ast-grep` and `pnpm tc`.

## Risks

- **Nothing enforces the behavior rules.** Like any other chat, the partner can edit a project in
  place if it misjudges. Mitigations:
  - the rule that any change to a project is a ticket, however small;
  - the runbook's judgment checks;
  - an opt-in fence later, if dogfooding shows overreach.
- **The user's agent config shapes the main chat.** Their MCP servers, `~/.claude` allow rules
  and CLAUDE.md all apply in the main home. That is the point of the Slack example, but a
  user-level instruction file can also conflict with the partner prompt.

- **The direct `NativeChatView` mount is unproven.** Spike it before building the rest of W5.
- **The first-turn prompt is weaker than a file.** It is visible, it is not re-sent on resume, and
  compaction can summarize it away. It is used only for agents with no file channel.
- **The hidden home is still visible to the partner** through `repo list --json`, and to mobile
  through the active-agents feed. The prompt handles the first case. The second is acceptable for M1.

## If a fence comes back

The facts from the investigation, kept for an opt-in fence later:

- **`Bash(orca:*)` alone is porous.** `orca terminal send`, `orca computer`, `orca tab`,
  `orca agent launch` and `orca worktree rm` can run or change arbitrary things, so a fence needs
  a deny list of those prefixes. Generate it from one table, together with the prompt's tooling
  section, so the two cannot drift.
- **Claude** honors project `permissions.allow` only in a trusted folder. Trust is per Claude
  config file, and an Orca Claude profile has its own. The trust writer is
  `applyAgentWorkspaceTrust` (`agent-launch/trust/agent-workspace-trust.ts:74`); it returns
  `missing-config` when Claude has never run on the host.
- **Codex** Ask is a read-only sandbox plus on-request approvals. Restriction rules use
  execpolicy `forbidden`, which beats `allow`. Its folder trust is `markCodexProjectTrusted`.
- **Keeping a session in a mode** needs a refusal at the single writer of `record.permissionMode`
  (`structured-agent-session-option-intent.ts`). That is a Track edit to native chat.
- **ACP agents** route every permission request through Orca, so an Orca-side allow-list is the
  natural seam there.
- **Windows** needs `orca.exe` and `orca.cmd` pattern variants.
- **OpenClaw's own docs warn** that allowing a shell tool does not make it read-only.

## Deferred, with OpenClaw notes

These are not M1. They are recorded here so the M1 code leaves room for them.

- **M2, preferences and notes as injected sections.** OpenClaw's `USER.md` and `MEMORY.md` split
  maps onto them:
  - preferences are imperative and replaced in place;
  - notes are curated facts;
  - bulk history stays out of the prompt and is reached through `orca tmwk history`.

  Use a hard character budget per section. A preference is dropped whole rather than cut
  mid-rule. Any trimming adds one fixed "briefing is partial" line.

- **M2, the owner brief.** Owners get a minimal bundle and never the partner's notes, as OpenClaw
  sub-agents get only `AGENTS.md`. An owner report must carry a result or a concrete blocker; an
  empty report is a failure.
- **M2, agent switching.** The agent is resolved once, when the pin is created. Changing the
  default agent later does not replace the live main session and its history. M2 decides how to
  offer a switch, for example a prompt to start a new main session with the new default.
- **M3, rollover.** A hidden pre-rollover "flush" turn that only records preferences and notes,
  is append-only and deduplicated, and never loses the session on failure.
- **M3, volatile context.** Date, host, tickets and open decisions go in a per-turn or per-wake
  context block, so the files written at spawn stay stable.
- **M3, "while you were away".** A coalesced notice queue plus a `tickets --since <version>`
  delta read.
- **M3 and later, a scheduled wake.** Run a cheap deterministic precheck before any model turn,
  and stay quiet by default.
- **Not adopted:** OpenClaw's persona and identity files and their first-run naming setup
  (no gamification; progressive disclosure means the first run asks nothing), and the
  `HEARTBEAT.md` and `TOOLS.md` files, which OpenClaw itself has retired.

## Doc updates

Done with this guide: main-chat.md's "Behavior" now has "Inline or delegate" in place of "The
partner never edits". "Tool fence" says there is no hard fence in v1, and the M1 milestone row
is updated.

Land these with the code:

- **main-chat.md, "Main session":** replace the M1 preset-append bullet with the agent-neutral
  builder and transports. Remove the permission-mode open question: the main session runs in the
  user's own mode. (`agent.launch` `chatOptions` could carry one if ever needed.)
- **main-chat.md, "Main view":** note that the crew panel is disabled upstream and out of M1.
- **main-chat.md, M0 findings 1–3:** mark them moot for v1 (no fence). For finding 7, keep only the `AGENTS.md` part, and note that
  Codex folder trust is `markCodexProjectTrusted` (`agent-launch/trust/agent-trust-presets.ts`),
  and that `src/main/codex/trust` is hook trust.
- **fork-ownership.md:**
  - the rows in [Ownership changes](#ownership-changes);
  - one patch-log line per Extend patch;
  - a decision-log line, including "no hard fence in v1";
  - mark the gate enforced.
- **`resources/tmwk/main-partner.md`:** the W2 edits.
