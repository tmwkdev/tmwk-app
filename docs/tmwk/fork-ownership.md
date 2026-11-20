# Fork ownership map

tmwk is a hard fork of [Orca](https://github.com/stablyai/orca) (the `upstream` remote; `origin` is [tmwkdev/tmwk-app](https://github.com/tmwkdev/tmwk-app), where PRs go). We keep pulling
upstream because Orca's adapters, native chat, remote runtime and mobile app improve daily. We
also build tmwk's own product, the main chat and the work layer under it, on Orca's agent primitives. This map records
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
the CLI and runtime RPC, the slow seam. The map splits the code into two domains, and each path is in exactly one of four states.

## Two domains

**Orca's domain is how the app talks to agents.** It covers agent adapters, native chat, sessions and transcripts, terminals, the remote runtime and SSH, mobile, and orchestration's plumbing: mail delivery, worker launch, custody, lifecycle, approvals and federation. We merge it from upstream and do not edit it.

**tmwk's domain is the work layer.** It covers the main chat, tickets and their owners, reports, questions and decisions, briefs and preferences, worker instructions and tmwk's worker skill, the away digest and acceptance. We build it on Orca's primitives (agent launch, messaging, session reads, host placement), which we call through runtime RPC or the `orca` CLI.

Orca's orchestration also has a work model of its own: Runs, Tasks, gates, the coordinator. tmwk replaces it by no longer depending on it, never by deleting or editing it. It stays in the tree, merges as-is, and still serves agents that use the `orchestration` skill directly. That skill stays upstream's too: tmwk ships its own `tmwk` skill beside it for owners of tmwk tickets, and points to `orchestration` for Orca's commands. The full reasoning is in [orchestration-ownership-plan.md](orchestration-ownership-plan.md).

## States

| State       | Rule                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Track**   | Upstream's code. Make no local edits. Take every upstream change as-is. A needed fix goes upstream, or it becomes a deliberate move to Extend.                                                                                                                                                                            |
| **Extend**  | Upstream's code with small tmwk patches: registration lines, new flags, or a shim that forwards to tmwk code. Never restructure or rename. Each patch is small enough to re-apply by hand after a conflicting merge, and is listed in the [patch log](#extend-patch-log).                                                 |
| **Adopted** | An upstream file tmwk has taken over at its upstream path. tmwk edits it freely. On sync, resolve with ours, then review upstream's diff of the file and log each change as ported or declined. Use it only where the path cannot move, because installs, generators or GitHub name it. Today: `README.md` and `LICENSE`. |
| **Own**     | tmwk's code under a `tmwk` or `main-chat` path. Upstream never touches it. It reaches Orca through runtime RPC or the `orca` CLI, never by importing `runtime/orchestration`, `runtime/rpc/methods/orchestration` or `runtime/rpc/orchestration`.                                                                         |

## The map

A path that is not listed is **Track**.

| Path                                                                                                                                                                                                                                                                                                                                  | Domain | State   | Notes                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/tmwk/**`                                                                                                                                                                                                                                                                                                                        | tmwk   | Own     | Product and design docs.                                                                                                                                                              |
| `src/main/tmwk/**`                                                                                                                                                                                                                                                                                                                    | tmwk   | Own     | Main session, home host, store, briefing, summary, tickets, reports, presence, worker instructions.                                                                                   |
| `src/cli/tmwk/**`                                                                                                                                                                                                                                                                                                                     | tmwk   | Own     | `orca tmwk …`: preferences, notes, history, briefs, tickets and the main chat.                                                                                                        |
| `src/shared/tmwk/**`, `src/shared/rpc-contract/tmwk/**`                                                                                                                                                                                                                                                                               | tmwk   | Own     | Shared types and `tmwk.*` RPC params (the catalog generator indexes `src/shared/rpc-contract/`).                                                                                      |
| `src/shared/tmwk/branding/**`                                                                                                                                                                                                                                                                                                         | tmwk   | Own     | Covered by `src/shared/tmwk/**`. The display name `TMWK_PRODUCT_NAME`, the brand pass for translated text and its keep-list ([brand plan](brand-plan.md) B0, B1).                     |
| `src/renderer/src/components/main-chat/**`                                                                                                                                                                                                                                                                                            | tmwk   | Own     | The main view. Composes `NativeChatView`; never patches inside it.                                                                                                                    |
| `resources/tmwk/**`                                                                                                                                                                                                                                                                                                                   | tmwk   | Own     | The partner prompt and other runtime-loaded assets.                                                                                                                                   |
| `resources/tmwk-brand/**`                                                                                                                                                                                                                                                                                                             | tmwk   | Own     | tmwk brand art: the beaver set and the tray template ([brand-plan.md](brand-plan.md) B7).                                                                                             |
| `resources/licenses/orca/**`                                                                                                                                                                                                                                                                                                          | tmwk   | Own     | Orca's original MIT license, kept verbatim; ships beside `LICENSE`.                                                                                                                   |
| `README.md`                                                                                                                                                                                                                                                                                                                           | tmwk   | Adopted | tmwk's README (D51, [brand-plan.md](brand-plan.md) B5). On sync, resolve with ours. `docs/readme/README.*.md` stay Track.                                                             |
| `LICENSE`                                                                                                                                                                                                                                                                                                                             | tmwk   | Adopted | tmwk's MIT license, © 2026 Ty Kowalewski. On sync, resolve with ours.                                                                                                                 |
| `config/ast-grep/rules/tmwk-*`, `config/ast-grep/rule-tests/tmwk-*`                                                                                                                                                                                                                                                                   | tmwk   | Own     | The import-boundary gate.                                                                                                                                                             |
| `skills/orchestration/**`, `skill-stubs/orchestration.md`, `skill-guides/orchestration.md`, `skill-guides/orchestration/**`                                                                                                                                                                                                           | Orca   | Track   | Upstream's orchestration skill. Never edited; tmwk ships its own skill instead. Was Extend, with no patch in it.                                                                      |
| `skills/tmwk/**`, `skill-stubs/tmwk.md`, `skill-guides/tmwk.md`, `skill-guides/tmwk/**`                                                                                                                                                                                                                                               | tmwk   | Own     | The `tmwk` owner skill (`orca skills get tmwk`). Covers the work layer; points to `orchestration` for Orca's commands.                                                                |
| `config/scripts/skills/bundle-generation/generate-bundled-skill-guides.mjs`                                                                                                                                                                                                                                                           | Orca   | Extend  | `'tmwk'` in `CANONICAL_GUIDE_NAMES`, `GUIDE_ALIASES` and `STUB_TOPICS`.                                                                                                               |
| `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts`                                                                                                                                                                                                                                                           | tmwk   | Extend  | A shim forwarding to `src/main/tmwk/worker-instructions/` (D33). It keeps `PreambleParams`, the CLI resolution and the send options.                                                  |
| `src/cli/skills/bundled-skill-guides.ts`, `src/main/skills/bundled-skill-install/bundled-skill-sources.ts`, `resources/skills/current-manifest.json`, `resources/skills/released-digests.json`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                                                                             | both   | Extend  | Generated. Never hand-edit; on a conflict, take theirs and regenerate.                                                                                                                |
| `src/cli/specs/index.ts`, `src/cli/dispatch/handler-group-manifest.ts`, `src/main/runtime/rpc/methods/rpc-method-registry.ts`                                                                                                                                                                                                         | Orca   | Extend  | One registration each for `orca tmwk` and `tmwk.*`.                                                                                                                                   |
| `src/main/startup/runtime-startup/chat-journal-startup.ts`, `src/main/backend/core-runtime-activation.ts`                                                                                                                                                                                                                             | Orca   | Extend  | One line each: start the tmwk home bootstrap on the Electron and Node `orcad` hosts.                                                                                                  |
| `config/electron-builder.config.cjs`, `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`                                                                                                                                                                                                                               | Orca   | Extend  | Ship `resources/tmwk` with the app and the orcad bundle.                                                                                                                              |
| `config/scripts/orcad-distribution/server-artifact/pack-orcad-server-artifact.mjs`                                                                                                                                                                                                                                                    | Orca   | Extend  | Ships Orca's license in the server archive beside `LICENSE`.                                                                                                                          |
| `docs/site/src/components/layout/DocsFooter.tsx`                                                                                                                                                                                                                                                                                      | Orca   | Extend  | The footer credits tmwk and Orca and links both licenses.                                                                                                                             |
| `src/main/text-generation/source-control-text-generation-types.ts`, `src/main/text-generation/agent-generation-request.ts`, `src/main/text-generation/failures/source-control-agent-failure.ts`                                                                                                                                       | Orca   | Extend  | The `'tmwk-working-summary'` operation (M3 D28).                                                                                                                                      |
| `src/renderer/src/store/slices/ui/**`, `src/renderer/src/app-shell/**`, `src/renderer/src/components/sidebar/chrome/**`, `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`                                                                                                                                 | Orca   | Extend  | The `'main'` view, its mount and its sidebar entry.                                                                                                                                   |
| `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts`, `src/shared/rpc-contract/client-ui/client-ui-params.ts`, `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts`                                                                                                      | Orca   | Extend  | Add `'main'` and hide the right sidebar on it.                                                                                                                                        |
| `src/renderer/src/i18n/locales/en.json`                                                                                                                                                                                                                                                                                               | Orca   | Extend  | `tmwk.mainChat` strings.                                                                                                                                                              |
| `src/shared/i18n/orca-i18n-instance.ts`                                                                                                                                                                                                                                                                                               | Orca   | Extend  | One line: `translate` runs the Own `brandTmwkText` before pseudo-localization, so translated text says tmwk (brand plan B1, D44).                                                     |
| `config/scripts/development/launch/run-electron-vite-dev.mjs`, `src/main/startup/profile-startup/dev-instance-identity.ts`, `src/main/startup/gpu-recovery/gpu-lifecycle.ts`, `src/renderer/index.html`, `src/renderer/popout.html`, `src/renderer/space.html`, `src/main/tray/system-tray.ts`, `src/main/menu/app-menu-quit-item.ts` | Orca   | Extend  | One line each: the dock, app menu, About panel and window titles and tray tooltip show `TMWK_PRODUCT_NAME`; `appName` (Keychain) stays Orca (brand plan B2, D45).                     |
| `config/scripts/development/electron-bundle-cache/dev-electron-bundle-identity.mjs`, `src/main/startup/profile-startup/dev-instance-identity.ts` (appName)                                                                                                                                                                            | Orca   | Extend  | One line each: `appName` and the dev bundle name are `tmwk` / `tmwk Dev`, replacing the row above's "appName stays Orca" (brand plan D55).                                            |
| `src/main/github/client/fetch/orca-star.ts`, `src/renderer/src/components/star-nag/StarNagCard.tsx`, `src/renderer/src/components/star-nag/StarNagToastHost.tsx`                                                                                                                                                                      | Orca   | Extend  | One line each: the star prompt points at tmwk's repository (brand plan B3, D47).                                                                                                      |
| `AGENTS.md`, `.gitignore`                                                                                                                                                                                                                                                                                                             | Orca   | Extend  | The tmwk section at the top; the `docs/tmwk/` allowlist.                                                                                                                              |
| `src/main/runtime/orchestration/**` (rest)                                                                                                                                                                                                                                                                                            | Orca   | Track   | Plumbing tmwk calls through RPC, and a work model tmwk no longer depends on (see [Two domains](#two-domains)).                                                                        |
| `src/main/runtime/rpc/methods/orchestration/**`, `src/main/runtime/rpc/orchestration/**`                                                                                                                                                                                                                                              | Orca   | Track   | Orchestration's RPC layer. The second-most-churned orchestration code.                                                                                                                |
| `src/cli/orchestration/**`, `src/shared/orchestration/**`                                                                                                                                                                                                                                                                             | Orca   | Track   | The CLI contract tmwk calls. `src/cli/orchestration/**` was Extend, with no patch in it. tmwk may import `src/shared/orchestration/**` and reuse `src/cli/orchestration/identity/**`. |
| `src/main/native-chat/**`, `src/renderer/src/components/native-chat/**`                                                                                                                                                                                                                                                               | Orca   | Track   | Most-churned code in the repo.                                                                                                                                                        |
| `src/main/claude/**`, `src/main/codex/**`, `src/main/acp/**`, other agent adapters, `src/main/agent-launch/**`                                                                                                                                                                                                                        | Orca   | Track   |                                                                                                                                                                                       |
| `src/main/orcad/**`, `src/main/daemon/**`, `src/main/ssh/**`, `src/main/runtime/**` (rest), `src/main/skills/**`                                                                                                                                                                                                                      | Orca   | Track   | Runtime, remote and headless hosts, skill install.                                                                                                                                    |
| `mobile/**`                                                                                                                                                                                                                                                                                                                           | Orca   | Track   |                                                                                                                                                                                       |
| Everything else                                                                                                                                                                                                                                                                                                                       | Orca   | Track   |                                                                                                                                                                                       |

## Changing a path's state

Moving a path to a new state is a decision, so record it rather than letting it drift:

1. Update the row above.
2. Add a line to the [decision log](#decision-log) with the date and the reason.
3. Moving to **Adopted**: from then on, resolve that path with ours on the sync branch, and add it to the sync review list.
4. Moving to **Own**: move the code to a `tmwk` path, and leave a shim (Extend) at the old path if Track code imports it.

Signals that a path should move:

- An Extend path conflicts on most syncs. Upstream is reshaping it, so the patch either goes upstream or the path moves.
- tmwk needs product behavior the Track code will not have. Build it in Own beside the Track code and stop calling the Track version. Do not edit it.
- A Track path needs a local fix that upstream will not take. Move it to Extend.

## Syncing with upstream

Pull upstream weekly, not continuously:

1. `git fetch upstream`, merge `upstream/main` into an `upstream-sync` branch, and open a PR to `origin/main`. Pushing to `upstream` is disabled.
2. **Track:** should merge clean. A conflict means a stray tmwk edit. Revert it, or log it as Extend.
3. **Extend:** re-apply each patch from the log. On a preamble shim conflict, add the new `PreambleParams` fields to the shim and the tmwk renderer, and port new section text.
4. **Upstream's `orchestration` skill:** take it as-is. Read `git diff <previous sync base>..upstream/main -- skills/orchestration skill-stubs/orchestration.md skill-guides/orchestration.md skill-guides/orchestration`, and fix the tmwk skill or preamble in the PR if a change contradicts them. **Adopted** paths, if any: resolve with ours, and list each upstream change as ported or declined.
5. **Generated:** take theirs, then run `pnpm generate:bundled-skill-guides`, `pnpm generate:skill-bundle-manifest` and `pnpm generate:rpc-params-catalog`.
6. **Own:** never conflicts. A conflict means upstream added a file at our path, so rename ours.
7. Run `pnpm check:changed`, then the main chat smoke check (end-to-end delegation, defined in [main-chat.md](main-chat.md#milestones)).
8. Note any Extend path that conflicted. Repeated conflicts mean the path should move.

## Guardrails

- **Import boundary, enforced.** `tmwk-no-orchestration-internals` (`config/ast-grep/rules/tmwk-no-orchestration-internals.yml`) rejects imports of `runtime/orchestration`, `runtime/rpc/methods/orchestration` and `runtime/rpc/orchestration` from `src/cli/tmwk`, `src/main/tmwk`, `src/shared/tmwk` and `src/renderer/src/components/main-chat`. It runs in `pnpm lint:ast-grep-gates`.
- **Track never imports tmwk,** except the Extend lines in the patch log.
- **Naming:** tmwk code lives under a `tmwk` or `main-chat` path segment, so ownership is visible from the path alone. Adopted files (`README.md`, `LICENSE`) are the only tmwk-owned files outside such a path, and the map lists every one.

## Extend patch log

One line per patch: path, what it adds, and why.

- `src/renderer/src/components/sidebar/chrome/SidebarNav.tsx`: removes the former top-navigation Chat mount; utility navigation remains in place.
- `src/renderer/src/components/sidebar/chrome/SidebarToolbar.tsx`: mounts the Own compact Chat dock immediately above the bottom toolbar, outside the Projects/Activity scroll area.
- `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`: excludes the main-chat view from active-card highlighting so only the current destination looks selected.

- `AGENTS.md`: adds the "tmwk Fork" section at the top, pointing to this map, so every agent
  reads ownership before editing.
- `.gitignore`: allowlists `docs/tmwk/`. Upstream ignores everything under `docs/` except an
  allowlist, so without this line these docs would never be committed.
- `src/main/startup/runtime-startup/chat-journal-startup.ts`: one line, `void startTmwkMainHome(state.runtime)`, to bootstrap the main home on the Electron host.
- `src/main/backend/core-runtime-activation.ts`: one lazy import and call of the same bootstrap on the Node `orcad` host.
- `config/electron-builder.config.cjs`: adds `resources/tmwk` as an extra resource and excludes it from `files`.
- `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`: copies `resources/tmwk` into the orcad bundle.
- `config/scripts/orcad-distribution/server-artifact/pack-orcad-server-artifact.mjs`: copies `resources/licenses/orca/LICENSE` into the server archive as `ORCA-LICENSE`, next to `LICENSE`.
- `docs/site/src/components/layout/DocsFooter.tsx`: the source footer points at `tmwkdev/tmwk-app/tree/main/docs/site`; the footer's copyright line credits tmwk (© Ty Kowalewski) and Orca, linking tmwk's `LICENSE` and Orca's kept license, as the README does.
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

- `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts`: a shim. It keeps `PreambleParams`, the `orca`/`orca-dev` resolution, `dispatchPreambleSendOptions` and re-exports of the two redispatch paragraphs, and forwards to `renderWorkerPreamble` in `src/main/tmwk/worker-instructions/render-worker-preamble.ts`, which holds the text (including PR #24's subagents line). On a conflict, add new `PreambleParams` fields to the shim and the renderer, and port new section text into the renderer.
- `config/scripts/skills/bundle-generation/generate-bundled-skill-guides.mjs`: `'tmwk'` in `CANONICAL_GUIDE_NAMES`, `GUIDE_ALIASES` and `STUB_TOPICS`, so the `tmwk` skill is bundled, served by `skills get` and installable.
- `src/cli/skills/bundled-skill-guides.ts`, `src/main/skills/bundled-skill-install/bundled-skill-sources.ts`, `resources/skills/current-manifest.json`, `resources/skills/released-digests.json`: regenerated with the `tmwk` skill (`pnpm generate:bundled-skill-guides`, `pnpm generate:skill-bundle-manifest`).

- `src/shared/i18n/orca-i18n-instance.ts`: one line, `translate` wraps the `i18n.t` result in the Own `brandTranslatedText` (off under Vitest; also given the English fallback) before pseudo-localization, so every translated string says tmwk (brand plan B1, D44). Re-apply on a conflict; no catalog is edited.

- `config/scripts/development/launch/run-electron-vite-dev.mjs`: `createDockTitle` reads `tmwk-product-name.json`, so the dev dock, `.app` bundle and app menu say `tmwk: <branch>` (brand plan B2).
- `src/main/startup/profile-startup/dev-instance-identity.ts`: the display `name` is `TMWK_PRODUCT_NAME` (packaged) and `tmwk: <branch>` (dev fallback); `appName`, the Keychain name, stays `Orca` / `Orca Dev`.
- `src/main/startup/gpu-recovery/gpu-lifecycle.ts`: the About panel uses the display name and adds the upstream credit through the Own `withTmwkAboutCredit`.
- `src/renderer/index.html`, `popout.html`, `space.html`: static `<title>` says tmwk.
- `src/main/tray/system-tray.ts`: the tray's base tooltip says tmwk; it is a literal the translator does not reach.
- `src/main/menu/app-menu-quit-item.ts`: labels the macOS `role: 'quit'` item with `menu.quitApp` and the display name; unlabeled, Electron wrote `Quit Orca Dev` from `app.name`.
- `src/main/startup/profile-startup/dev-instance-identity.ts` (D55): `BASE_APP_NAME` is `TMWK_PRODUCT_NAME`, so `appName` is `tmwk` packaged and `tmwk Dev` in dev. This replaces the B2 entry's "appName stays Orca / Orca Dev". Dev's pre-ready `app.setName` moves the Keychain service to `tmwk Dev Safe Storage`. userData does not move: Electron sets it at init from `productName`, and dev pins it through `ORCA_DEV_USER_DATA_PATH`.
- `config/scripts/development/electron-bundle-cache/dev-electron-bundle-identity.mjs` (D55): `DEV_BUNDLE_DISPLAY_NAME` reads `tmwk-product-name.json` and is `tmwk Dev`, which is the dev bundle's `CFBundleName` and its bold menu-bar name. It stays the same on every branch, so the cdhash changes once.

- `src/main/text-generation/source-control-text-generation-types.ts`, `src/main/text-generation/agent-generation-request.ts`, `src/main/text-generation/failures/source-control-agent-failure.ts`: add the `'tmwk-working-summary'` operation id, run it tool-free like `dictation-cleanup`, and clean its output as prose, so the home host can run the background working-summary one-shot (M3 D28) through `runGenerationRequest`.

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

- 2026-11-18: M2 (D5–D14): the CLI reaches the store through a `tmwk.*` RPC namespace; briefs are rendered by `orca tmwk brief` with no orchestration patch.
- 2026-11-18: M3 (D15–D30): tmwk triggers rollover from context usage, keeps the working summary current with a background one-shot, writes into the main chat only as notices, shows running work in the main view, and keeps summaries, ticket snapshots and presence in the tmwk store.
- 2026-11-18: M3 W2 (D28): Extend the text-generation operation union and its tool-free and prose handling for `tmwk-working-summary`; the guide's Ownership changes table anticipated this.
- 2026-11-19: Own `resources/tmwk-brand/**` for tmwk's brand art, starting with the macOS tray template (brand plan B7).
- 2026-11-19: Brand plan B0 (D42–D54, [brand-plan.md](brand-plan.md#decisions)): user-visible text says `tmwk` through `TMWK_PRODUCT_NAME` in Own `src/shared/tmwk/branding/`; identifiers (`appName`, userData, bundle ids, `orca://`, `ORCA_*`, the `orca` CLI) stay. Rows added for the Extend files B1–B3 touch.
- 2026-11-19: D31 (orchestration ownership plan, O0): the map is organized by domain (Orca's agent plumbing, tmwk's work layer) and gains the Adopted state. `src/cli/orchestration/**` moves from Extend to Track, and upstream's `orchestration` skill paths move from Extend to Track (D34); neither had a tmwk patch. The import gate also rejects orchestration's RPC layer (D41).
- 2026-11-19: O1, D33: the worker instructions move to `src/main/tmwk/worker-instructions/` (Own). `worker-dispatch-preamble.ts` stays Extend, now as a one-file shim; its patch-log line replaces PR #24's.
- 2026-11-19: O1, D34: tmwk ships its own `tmwk` skill (Own, name decided by the owner) beside upstream's `orchestration` skill, which stays Track and unedited. The generator lists are Extend. Orca installs a bundled skill only when a user names it, so tmwk's bootstrap installs `tmwk` on any host where `orchestration` is already installed and `tmwk` is absent, through `skills.planBundledOrca` and `skills.executeBundledOrca`; it never overwrites a copy.
- 2026-11-19: Brand plan D55 ([brand-plan.md](brand-plan.md#decisions)) reverses D43/D45 for `appName`: it is `tmwk` / `tmwk Dev`, and the dev bundle's `CFBundleName` is `tmwk Dev`. Dev safeStorage secrets need re-entry once; userData, `productName`, bundle ids, `orca://`, `ORCA_*` and the `orca` CLI stay (P1–P4).
