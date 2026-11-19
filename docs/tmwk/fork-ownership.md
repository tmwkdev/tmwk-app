# Fork ownership map

tmwk is a hard fork of [Orca](https://github.com/stablyai/orca) (the `upstream` remote; `origin` is [tmwkdev/tmwk-app](https://github.com/tmwkdev/tmwk-app), where PRs go). We keep pulling
upstream because Orca's adapters, native chat, remote runtime and mobile app improve daily. We
also build tmwk's own product, the main chat, on top of Orca's orchestration. This map records
which code is whose, so a merge from upstream never fights with our work.

**Before editing any file, find its row below and follow that state's rule.** A path that is
not listed is **Track**.

## Why the map exists

Upstream changes very quickly, and unevenly. Here is a 30-day snapshot taken on 2026-11-17,
with about 7,200 upstream commits in the window:

| Area                                          | Commits | Lines changed |
| --------------------------------------------- | ------: | ------------: |
| `src/main/runtime/orchestration` (~55k lines) |     288 |          115k |
| `src/cli/orchestration`                       |      15 |            7k |
| `skill-guides/orchestration.md`               |      22 |           424 |
| `src/main/native-chat`                        |     541 |          444k |
| `src/renderer/src/components/native-chat`     |     880 |          301k |

The orchestration internals rewrite themselves about twice a month. The `orca` CLI in front of
them barely moves. Upstream treats the CLI as a compatibility surface, because skills depend on
it and paired servers on different versions talk through it: retired commands return recovery
text instead of disappearing.

A stable foundation and pulling upstream cannot both apply to the same code. If we edit the
internals and keep merging, we get constant conflicts in the fastest-changing code. If we edit
them and stop merging, we freeze a module mid-rewrite and own all of it. So tmwk builds against
the CLI, the slow seam, and each directory is in exactly one of three states.

## States

| State      | Rule                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Track**  | Upstream's code. Make no local edits. Take every upstream change as-is. A needed fix goes upstream, or it becomes a deliberate move to Extend.                                                                                                                |
| **Extend** | Upstream's code with small, additive tmwk patches: new flags, commands, or one registration line. Never restructure or rename. Each patch is small enough to re-apply by hand after a conflicting merge, and is listed in the [patch log](#extend-patch-log). |
| **Own**    | tmwk's code. Upstream never touches it, so merges never conflict. It reaches orchestration only through the `orca` CLI or runtime RPC, never by importing `src/main/runtime/orchestration/**`.                                                                |

## The map

| Path                                                                                                                                                                                                                             | State   | Notes                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/tmwk/**`                                                                                                                                                                                                                   | Own     | Product and design docs.                                                                                                  |
| `src/main/tmwk/**`                                                                                                                                                                                                               | Own     | Main chat session, home host, tmwk store, briefing, summary.                                                              |
| `src/cli/tmwk/**`                                                                                                                                                                                                                | Own     | `orca tmwk …` commands: preferences, notes, history, main chat.                                                           |
| `src/shared/tmwk/**`                                                                                                                                                                                                             | Own     | Types shared by tmwk main, CLI and renderer.                                                                              |
| `src/renderer/src/components/main-chat/**`                                                                                                                                                                                       | Own     | The main view. Composes `NativeChatView`; never patches inside it.                                                        |
| `resources/tmwk/**`                                                                                                                                                                                                              | Own     | The partner prompt and other runtime-loaded assets.                                                                       |
| `resources/tmwk-brand/**`                                                                                                                                                                                                        | Own     | tmwk brand art: the beaver set and the tray template ([brand-plan.md](brand-plan.md) B7).                                 |
| `config/ast-grep/rules/tmwk-*`, `config/ast-grep/rule-tests/tmwk-*`                                                                                                                                                              | Own     | The import-boundary gate. New files only.                                                                                 |
| `src/cli/orchestration/**`                                                                                                                                                                                                       | Extend  | New flags or commands the main chat needs.                                                                                |
| `skill-guides/orchestration*`, `skills/orchestration/**`, `skill-stubs/orchestration.md`                                                                                                                                         | Extend  | Only additions that teach workers about tmwk.                                                                             |
| `src/renderer/src/store/slices/ui/**`                                                                                                                                                                                            | Extend  | Adds the `'main'` view to `activeView`.                                                                                   |
| `src/renderer/src/app-shell/**`, `src/renderer/src/components/sidebar/chrome/**`                                                                                                                                                 | Extend  | Mounts the main view and its sidebar entry.                                                                               |
| `src/main/startup/runtime-startup/chat-journal-startup.ts`, `src/main/backend/core-runtime-activation.ts`                                                                                                                        | Extend  | One line each: start the tmwk home bootstrap on the Electron and Node `orcad` hosts.                                      |
| `config/electron-builder.config.cjs`, `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`                                                                                                                          | Extend  | Ship `resources/tmwk` with the app and the orcad bundle.                                                                  |
| `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts`, `src/shared/rpc-contract/client-ui/client-ui-params.ts`, `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts` | Extend  | Add the `'main'` view and suppress the right sidebar on it.                                                               |
| `AGENTS.md`                                                                                                                                                                                                                      | Extend  | The tmwk section at the top only.                                                                                         |
| `.gitignore`                                                                                                                                                                                                                     | Extend  | The `docs/tmwk/` allowlist lines only.                                                                                    |
| `README.md`                                                                                                                                                                                                                      | Adopted | tmwk's README (D51, [brand-plan.md](brand-plan.md) B5). On sync, resolve with ours. `docs/readme/README.*.md` stay Track. |
| `src/main/runtime/orchestration/**`                                                                                                                                                                                              | Track   | The foundation. Reached only through the CLI. Candidate for Own later.                                                    |
| `src/main/native-chat/**`, `src/renderer/src/components/native-chat/**`                                                                                                                                                          | Track   | Most-churned code in the repo.                                                                                            |
| `src/main/claude/**`, `src/main/codex/**`, `src/main/acp/**`, other agent adapters                                                                                                                                               | Track   |                                                                                                                           |
| `src/main/orcad/**`, `src/main/daemon/**`, `src/main/ssh/**`, `src/main/runtime/**` (rest)                                                                                                                                       | Track   | Remote and headless runtime.                                                                                              |
| `mobile/**`                                                                                                                                                                                                                      | Track   |                                                                                                                           |
| `src/main/runtime/rpc/methods/rpc-method-registry.ts`                                                                                                                                                                            | Extend  | Registers tmwk main-session methods implemented in Own code.                                                              |
| `src/shared/rpc-contract/tmwk/**`                                                                                                                                                                                                | Own     | tmwk RPC schemas discovered by the generated catalog.                                                                     |
| `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                                                                                                                                                                        | Extend  | Generated tmwk method entries alongside upstream entries.                                                                 |
| `src/renderer/src/i18n/locales/en.json`                                                                                                                                                                                          | Extend  | Additive tmwk main-chat English strings.                                                                                  |
| `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`                                                                                                                                                     | Extend  | Suppresses the last workspace highlight while the main chat is open.                                                      |
| `src/main/text-generation/source-control-text-generation-types.ts`, `src/main/text-generation/agent-generation-request.ts`, `src/main/text-generation/failures/source-control-agent-failure.ts`                                  | Extend  | The `'tmwk-working-summary'` operation id and its prose, tool-free handling, for the background summary refresh (M3 D28). |
| Everything else                                                                                                                                                                                                                  | Track   |                                                                                                                           |
| Path                                                                                                                                                                                                                             | State   | Notes                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------  | ----------------------------------------------------------------------------------------------------------------          |
| `docs/tmwk/**`                                                                                                                                                                                                                   | Own     | Product and design docs.                                                                                                  |
| `src/main/tmwk/**`                                                                                                                                                                                                               | Own     | Main chat session, home host, tmwk store, briefing, summary.                                                              |
| `src/cli/tmwk/**`                                                                                                                                                                                                                | Own     | `orca tmwk …` commands: preferences, notes, history, main chat.                                                           |
| `src/shared/tmwk/**`                                                                                                                                                                                                             | Own     | Types shared by tmwk main, CLI and renderer.                                                                              |
| `src/renderer/src/components/main-chat/**`                                                                                                                                                                                       | Own     | The main view. Composes `NativeChatView`; never patches inside it.                                                        |
| `resources/tmwk/**`                                                                                                                                                                                                              | Own     | The partner prompt and other runtime-loaded assets.                                                                       |
| `resources/tmwk-brand/**`                                                                                                                                                                                                        | Own     | tmwk brand art: the beaver set and the tray template ([brand-plan.md](brand-plan.md) B7).                                 |
| `config/ast-grep/rules/tmwk-*`, `config/ast-grep/rule-tests/tmwk-*`                                                                                                                                                              | Own     | The import-boundary gate. New files only.                                                                                 |
| `src/shared/rpc-contract/tmwk/**`                                                                                                                                                                                                | Extend  | New files only: `tmwk.*` RPC params. The catalog generator indexes params only under `src/shared/rpc-contract/`.          |
| `src/cli/specs/index.ts`, `src/cli/dispatch/handler-group-manifest.ts`, `src/main/runtime/rpc/methods/rpc-method-registry.ts`                                                                                                    | Extend  | One import and one registration each for the `orca tmwk` group and the `tmwk.*` RPC namespace.                            |
| `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                                                                                                                                                                        | Extend  | Generated by `pnpm generate:rpc-params-catalog`. Never hand-edit; on a merge conflict, regenerate.                        |
| `src/cli/orchestration/**`                                                                                                                                                                                                       | Extend  | New flags or commands the main chat needs.                                                                                |
| `skill-guides/orchestration*`, `skills/orchestration/**`, `skill-stubs/orchestration.md`                                                                                                                                         | Extend  | Only additions that teach workers about tmwk.                                                                             |
| `src/renderer/src/store/slices/ui/**`                                                                                                                                                                                            | Extend  | Adds the `'main'` view to `activeView`.                                                                                   |
| `src/renderer/src/app-shell/**`, `src/renderer/src/components/sidebar/chrome/**`                                                                                                                                                 | Extend  | Mounts the main view and its sidebar entry.                                                                               |
| `src/main/startup/runtime-startup/chat-journal-startup.ts`, `src/main/backend/core-runtime-activation.ts`                                                                                                                        | Extend  | One line each: start the tmwk home bootstrap on the Electron and Node `orcad` hosts.                                      |
| `config/electron-builder.config.cjs`, `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`                                                                                                                          | Extend  | Ship `resources/tmwk` with the app and the orcad bundle.                                                                  |
| `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts`, `src/shared/rpc-contract/client-ui/client-ui-params.ts`, `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts` | Extend  | Add the `'main'` view and suppress the right sidebar on it.                                                               |
| `AGENTS.md`                                                                                                                                                                                                                      | Extend  | The tmwk section at the top only.                                                                                         |
| `.gitignore`                                                                                                                                                                                                                     | Extend  | The `docs/tmwk/` allowlist lines only.                                                                                    |
| `src/main/runtime/orchestration/**`                                                                                                                                                                                              | Track   | The foundation. Reached only through the CLI. Candidate for Own later.                                                    |
| `src/main/native-chat/**`, `src/renderer/src/components/native-chat/**`                                                                                                                                                          | Track   | Most-churned code in the repo.                                                                                            |
| `src/main/claude/**`, `src/main/codex/**`, `src/main/acp/**`, other agent adapters                                                                                                                                               | Track   |                                                                                                                           |
| `src/main/orcad/**`, `src/main/daemon/**`, `src/main/ssh/**`, `src/main/runtime/**` (rest)                                                                                                                                       | Track   | Remote and headless runtime.                                                                                              |
| `mobile/**`                                                                                                                                                                                                                      | Track   |                                                                                                                           |
| `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`                                                                                                                                                     | Extend  | Suppresses the last workspace highlight while the main chat is open.                                                      |
| Everything else                                                                                                                                                                                                                  | Track   |                                                                                                                           |

## Changing a path's state

Moving a path to a new state is a decision, so record it rather than letting it drift:

1. Update the row above.
2. Add a line to the [decision log](#decision-log) with the date and the reason.
3. When moving to **Own**, stop merging that path. On the sync branch, resolve its conflicts
   with ours, and add it to the sync checklist.

Signals that a path should move:

- An Extend path conflicts on most syncs. Upstream is reshaping it, so the patch either goes
  upstream or the path becomes Own.
- tmwk needs orchestration semantics upstream will not have, such as tickets as first-class
  records or a different wake model. That is the point to move orchestration to Own.
- A Track path needs a local fix that upstream will not take. Move it to Extend.

## Syncing with upstream

Pull upstream on a weekly cadence, not continuously:

1. `git fetch upstream` and merge `upstream/main` into an `upstream-sync` branch, then open a PR to `origin/main`. Pushing to `upstream` is disabled locally.
2. Conflicts should appear only in Extend paths. Re-apply each patch from the patch log.
   A conflict in an Own path means upstream added a file at our path: rename ours.
3. Run `pnpm check:changed`, then the main chat smoke check (end-to-end delegation, defined
   in [main-chat.md](main-chat.md#milestones)).
4. Note any Extend path that conflicted. Repeated conflicts mean the path should move state.

## Guardrails

- **Import boundary: enforced.** The ast-grep rule `tmwk-no-orchestration-internals`
  (`config/ast-grep/rules/tmwk-no-orchestration-internals.yml`) rejects imports of
  `runtime/orchestration` from `src/cli/tmwk`, `src/main/tmwk`, `src/shared/tmwk` and
  `src/renderer/src/components/main-chat`. It runs in `pnpm lint:ast-grep-gates`.
- **Naming:** tmwk code lives under a `tmwk` or `main-chat` path segment, so ownership is
  visible from the path alone.

## Extend patch log

One line per patch: path, what it adds, and why.

- `src/renderer/src/components/sidebar/chrome/SidebarNav.tsx`: places the Own Chat entry first in global navigation, outside Projects.
- `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`: excludes the main-chat view from active-card highlighting so only the current destination looks selected.

- `AGENTS.md`: adds the "tmwk Fork" section at the top, pointing to this map, so every agent
  reads ownership before editing.
- `.gitignore`: allowlists `docs/tmwk/`. Upstream ignores everything under `docs/` except an
  allowlist, so without this line these docs would never be committed.
- `src/main/startup/runtime-startup/chat-journal-startup.ts`: one line, `void startTmwkMainHome(state.runtime)`, to bootstrap the main home on the Electron host.
- `src/main/backend/core-runtime-activation.ts`: one lazy import and call of the same bootstrap on the Node `orcad` host.
- `config/electron-builder.config.cjs`: adds `resources/tmwk` as an extra resource and excludes it from `files`.
- `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`: copies `resources/tmwk` into the orcad bundle.
- `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts`, `src/shared/rpc-contract/client-ui/client-ui-params.ts`: add `'main'` to `TopLevelView`, its lookup and the RPC schema.
- `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts`: hides the right sidebar on the main view.
- `src/cli/specs/index.ts`: spreads `TMWK_COMMAND_SPECS` so `orca tmwk` shows in help and validates its flags.
- `src/cli/dispatch/handler-group-manifest.ts`: lists `TMWK_HANDLER_GROUP`, which lazy-loads the tmwk handlers.
- `src/main/runtime/rpc/methods/rpc-method-registry.ts`: spreads `TMWK_RPC_METHODS` so the home runtime serves the `tmwk.*` namespace.
- `src/shared/rpc-contract/rpc-params-catalog.generated.ts`: regenerated entries for the `tmwk.*` methods.
- `src/shared/rpc-contract/tmwk/**`: new files only, holding the `tmwk.*` params so the catalog generator indexes them.

- `src/main/runtime/rpc/methods/rpc-method-registry.ts`: registers `TMWK_MAIN_SESSION_METHODS` from Own code.

- `src/shared/rpc-contract/rpc-params-catalog.generated.ts`: generated parameter bindings for the tmwk main-session methods.

- `src/renderer/src/i18n/locales/en.json`: adds the `tmwk.mainChat` agent-switching and navigation-context strings.

- `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts`: one preamble line, replacing "Do only this task, yourself: no subagents or helper workers unless the task asks." with wording that encourages workers to use their own subagents and workflows; Orca helper workers stay gated on the task asking.

## Decision log

- 2026-11-18: Extend `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts` for one line; the user wants dispatched workers encouraged to use subagents and workflows, not told to work alone.

- 2026-11-18: Extend `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx` for one main-view selection exclusion; the main chat and last workspace must not both appear active.

- 2026-11-17: Map created. Orchestration is Track and is reached only through the CLI. The main
  chat and its memory are Own.
- 2026-11-17: M1 decisions. No hard tool fence in v1: the partner follows inline-or-delegate
  rules and the session runs in the user's own mode. The partner prompt is agent-neutral
  (builder plus per-agent transports), with no Claude preset patch. D1: `TMWK_HOME_HOST=1`
  marks a home host; a desktop is home unless it is `0`. D2: `'main'` is the launch view on the
  startup hydrate. D3: the crew panel is out of M1. D4: the main session uses `defaultTuiAgent`.
  The import-boundary gate is enforced. Rows added for the gate files (Own) and the Extend
  patches above.

- 2026-11-18: Move `src/main/runtime/rpc/methods/rpc-method-registry.ts` to Extend for a tmwk method registration, allowing main-chat agent switching on the home host without editing native-chat internals.

- 2026-11-18: Own `src/shared/rpc-contract/tmwk/**` and Extend the generated RPC params catalog so tmwk methods meet the host catalog parity gate without changing the generator.

- 2026-11-18: Extend `src/renderer/src/i18n/locales/en.json` with tmwk-only keys so main-chat controls follow the localization contract.
- `src/main/text-generation/source-control-text-generation-types.ts`, `src/main/text-generation/agent-generation-request.ts`, `src/main/text-generation/failures/source-control-agent-failure.ts`: add the `'tmwk-working-summary'` operation id, run it tool-free like `dictation-cleanup`, and clean its output as prose, so the home host can run the background working-summary one-shot (M3 D28) through `runGenerationRequest`.

- 2026-11-18: M2 (D5–D14): the CLI reaches the store through a `tmwk.*` RPC namespace; briefs are rendered by `orca tmwk brief` with no orchestration patch.
- 2026-11-18: M3 (D15–D30): tmwk triggers rollover from context usage, keeps the working summary current with a background one-shot, writes into the main chat only as notices, shows running work in the main view, and keeps summaries, ticket snapshots and presence in the tmwk store.
- 2026-11-18: M3 W2 (D28): Extend the text-generation operation union and its tool-free and prose handling for `tmwk-working-summary`; the guide's Ownership changes table anticipated this.
- 2026-11-19: Own `resources/tmwk-brand/**` for tmwk's brand art, starting with the macOS tray template (brand plan B7).
