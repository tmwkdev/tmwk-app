# M2 implementation guide: preferences, notes and history

This guide turns the M2 row of [main-chat.md](main-chat.md#milestones) into build steps. It was written on 2026-11-17 from a read of M1 on `tykowale/m1` (`1740b5a784f`, on top of `ab86f61e38f`), the [M0 findings](main-chat.md#m0-findings), and the Track code M2 touches. At that point the M1 runbook was still being run. M1 has since merged (PR #2, `d4b957b2c77`, followed by `ee6904ebfb3`). Re-verify everything in [Preconditions](#preconditions-from-m1) against `main` before W1. M1's gates (`pnpm check:changed`, `pnpm tc`) were not run for this guide. Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked before they are relied on.

**Done when:**

- the `orca tmwk` preference, note and history commands exist;
- preferences reach briefings and owner briefs.

Preferences reaching a briefing has a narrow meaning in M2. The briefing renderer exists and the partner reads it (D7). M3 puts it in a per-turn block. Owner briefs get preferences inside the task spec (D6). The observable bar: in a fresh session, a preference saved earlier is applied without the user repeating it (runbook check 12).

Tickets and acceptance (W6) are a stretch step outside the done-when. They can slip to M3 without blocking M2.

## Preconditions from M1

M1 is merged to `main`. M2 builds on these M1 interfaces. Before W1, confirm each one still reads as written here.

| Interface                                                                                   | File                                                                                                                               | What M2 does with it                                                                   | Re-check after merge                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveMainHomePaths(env)` returns `{ root, mainHome, claudeMd, agentsMd, sessionRecord }` | `src/main/tmwk/main-home/main-home-paths.ts`                                                                                       | Adds a `storeDir` beside `main/`. The store derives from `root`.                       | The field names and the root precedence (`TMWK_HOME`, then `<userData>/tmwk` when unpackaged or E2E, then `~/.tmwk`).                                                                                |
| `isTmwkHomeHost(env = process.env, isElectronHost = Boolean(process.versions.electron))`    | `src/main/tmwk/main-home/home-host.ts`                                                                                             | Every `tmwk.*` handler refuses on a non-home host. Call it with no arguments.          | The defaults.                                                                                                                                                                                        |
| `createTmwkRpc(runtime)` and `TmwkRpcError`                                                 | `src/main/tmwk/main-session/tmwk-runtime-rpc.ts`                                                                                   | `history search`, project resolution and `tickets` call other runtime RPCs in process. | That it builds an `RpcDispatcher` over `ALL_RPC_METHODS` and works on the Node `orcad` host. M1 never recorded this **(verify)**. It imports the registry at top level, so see the cycle rule in W1. |
| `renderPartnerPrompt(basePrompt)`                                                           | `src/main/tmwk/partner-prompt/render-partner-prompt.ts`                                                                            | Left unchanged. The prompt stays static.                                               | Still only strips the header comment.                                                                                                                                                                |
| `writeMainHomeTransports(paths, prompt)`                                                    | `src/main/tmwk/main-home/ensure-main-home.ts`                                                                                      | A new prompt reaches `CLAUDE.md` and `AGENTS.md` on the next bootstrap.                | It still writes only when content differs.                                                                                                                                                           |
| `needsFirstTurnPrompt(agent)`                                                               | `src/main/tmwk/main-session/main-agent-selection.ts`                                                                               | Why a pushed briefing is not an option for all agents (D7).                            | Unchanged.                                                                                                                                                                                           |
| Gate `tmwk-no-orchestration-internals`                                                      | `config/ast-grep/rules/tmwk-no-orchestration-internals.yml`, `config/ast-grep/rule-tests/tmwk-no-orchestration-internals-test.yml` | W1 adds `src/cli/tmwk/**` to the `typescript` and `tsx` documents.                     | M1 left it out. Confirm it is still out, and that the gate proof (a probe import fails `pnpm lint:ast-grep-gates`) was run. M1 does not record it.                                                   |
| `writeFileAtomically(path, contents, { mode? })`                                            | `src/main/filesystem/atomic-file-publication.ts`                                                                                   | The store write primitive.                                                             | Still synchronous. Check the outcome of `check:main-sync-fs-ratchet` for the M1 files **(verify)**.                                                                                                  |
| Fork-ownership rows and patch log                                                           | `docs/tmwk/fork-ownership.md`                                                                                                      | M2 adds rows in the same PRs as the code.                                              | D1–D4 are logged, so M2 decisions start at D5.                                                                                                                                                       |

M1 loose ends M2 may hit. None is an M2 task, but each can break an M2 check. These were seen while the M1 runbook was still running, so re-read the merged runbook before trusting them:

- Some M1 runbook checks had no evidence yet. Inline lookup (3) and ask-first (5) were being captured. Delegation, the report loop, Codex and ACP agents, and the orcad home had none. If the orcad check stays unrun, M2 W1 is its first real test.
- `01-launch-main.png` and `02-main-session.png` were byte-identical, and so were `07-after-restart.png` and `08a-stray-open.png`. Checks 2 and 7 need distinct screenshots.
- `ensureMainSession` launches with `worktree: 'id:<worktreeId>'`, where the guide said `path:`. It does not handle a pin whose record is gone.
- `launchSource: 'tmwk'` is accepted only because the field is typed `string` **(verify)**.
- `MAIN_HOME_DISPLAY_NAME = 'tmwk main'` is shared by convention between the renderer and the bootstrap, with no common constant.
- Mobile (M1 W6) was never device-tested.

After the merge, run `git log --oneline` on `main` and check that the files above exist. Then run `pnpm tc` and `pnpm test:ast-grep` on a clean checkout. If an interface changed, fix this guide first.

## What changes from main-chat.md

Fold these into main-chat.md when M2 lands. See [Doc updates](#doc-updates).

1. **`orca tmwk brief` takes a goal, not a task id.** main-chat.md says `brief <taskId>`. A task id exists only after `orchestration task-create`, and the dispatch preamble embeds the spec as it was at creation. `orchestration.taskUpdate` takes only `{id, status, result, run}` **(verify there is no spec-editing RPC)**. A brief keyed by task id arrives too late. `brief` renders the spec first, and the partner creates the task from it (D6).
2. **The CLI reaches the store through a `tmwk.*` runtime RPC namespace.** This is what makes "runs against whichever runtime is home" true for an agent's shell, a paired desktop and `orcad`. It needs three Extend patches (D5).
3. **`orca session-search` is `orca search`.** The real command is defined in `src/cli/specs/search.ts`. Fix the table in main-chat.md and the partner prompt.
4. **Acceptance is an explicit command.** `tickets --needs-me` stays read-only, and `orca tmwk tickets accept <taskId>` records acceptance (D10). main-chat.md says the list "records acceptance", which would make a read have a side effect.
5. **Preferences reach the live partner by pull, not by file.** The prompt stays static. The partner runs `orca tmwk preference list` when it needs the rules (D7).
6. **Two small additions to the documented surface:** `preference remove <id>` (D12) and `tickets accept <taskId>`.

## Decisions

Numbering continues the fork-ownership decision log. **Owner call** means the recommendation changes a documented surface or a Track path and should be confirmed before W1 starts.

| #   | Decision                                              | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner call                                        |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| D5  | How `orca tmwk` reaches the store.                    | A `tmwk.*` RPC namespace on the home runtime. Handlers live in `src/main/tmwk/rpc/`, params in `src/shared/tmwk/rpc/`. Register with one import and one spread in `rpc-method-registry.ts`, and regenerate the catalog. The alternative, the CLI reading `~/.tmwk` directly, fails for a laptop CLI attached to a homelab. It also cannot compute the dev root `<userData>/tmwk`, which needs Electron's `app`.                                                                                  | Yes. It adds three Extend rows.                   |
| D6  | The `brief` signature and delivery.                   | `brief --goal <text>` renders the owner spec to stdout. The partner passes it to `task-create --spec`. A `--out <path>` flag lets the CLI write it to a file for `--spec-file`, so no shell quoting or shared filesystem is assumed. The prompt makes `brief` mandatory for every ticket. No Track edit. Fallback if dogfooding shows the partner skipping it: an Extend patch to `src/cli/orchestration/**` that appends preferences client-side (two sites, `task-create` and `worker-start`). | Yes. It deviates from `brief <taskId>`.           |
| D7  | How a changed preference reaches the running partner. | Pull. The static prompt tells the partner to run `orca tmwk preference list` before it creates a ticket, sends to an owner, or acts outward. `brief` embeds preferences every time. The briefing renderer is built now and M3 puts it in the per-turn block. Re-rendering `CLAUDE.md` per launch breaks byte-stability. It goes stale in a long pinned session and is never re-sent to first-turn agents.                                                                                        | Yes. This is the narrow reading of the done-when. |
| D8  | Store format.                                         | One JSON snapshot per area with a `version` field, rewritten atomically. Writes are serialized in the one home runtime process. No SQLite, and no use of the orchestration DB. Migrations are deferred.                                                                                                                                                                                                                                                                                          | No.                                               |
| D9  | What `--project` takes.                               | A repo selector resolved on the home runtime, as `orca repo list` resolves it. The record stores `{ repoId, name }`. It is a project, never a worktree, so folder workspaces work. How `repo.*` resolves a selector in process is **(verify)**. Whether `repoId` is stable across hosts is **unknown**.                                                                                                                                                                                          | Yes, on stability.                                |
| D10 | The acceptance gesture.                               | `orca tmwk tickets accept <taskId>`. `tickets` and `tickets --needs-me` never write acceptance.                                                                                                                                                                                                                                                                                                                                                                                                  | Yes.                                              |
| D11 | Whether notes are injected into briefings.            | No. M2 injects preferences only, as main-chat.md's briefing list says. Notes are reached through `history search`. Owners never get notes unless the partner cites one as evidence.                                                                                                                                                                                                                                                                                                              | No.                                               |
| D12 | How to drop a preference.                             | `preference remove <id>` marks it retired. The record is kept.                                                                                                                                                                                                                                                                                                                                                                                                                                   | Yes. It adds to the documented surface.           |
| D13 | Agent switching (M1 guide, deferred to M2).           | Defer to M3. It is not about preferences, notes or history, and no command or UI is specified.                                                                                                                                                                                                                                                                                                                                                                                                   | No.                                               |
| D14 | Whether `tickets` and acceptance are in M2.           | Stretch (W6), in its own PR, outside the done-when. Findings 4 and 5 assign them to M2, but they need orchestration read RPCs that are still unknown. Until W6 ships, the M1 prompt rule stands: every completed ticket needs the user.                                                                                                                                                                                                                                                          | Yes.                                              |

## The tmwk store

The store lives on the home host only. Worker hosts never hold it.

**Location.** `<root>/store/`, where `root` is `resolveMainHomePaths().root`. That is `TMWK_HOME`, else `<userData>/tmwk` when unpackaged, else `~/.tmwk` (`%USERPROFILE%` on Windows). W1 adds `storeDir = join(root, 'store')` to `MainHomePaths`. The existing `main-session.json` stays where it is.

| File                 | Holds                                | Step   |
| -------------------- | ------------------------------------ | ------ |
| `store/records.json` | Preferences and notes, with history. | W2, W3 |
| `store/tickets.json` | Ticket snapshots and acceptance.     | W6     |

Each file is `{ "version": 1, "records": [...] }`.

**Record shape.** One type in `src/shared/tmwk/tmwk-records.ts`, with an `isTmwkRecord` guard as `main-session-record.ts` has:

```ts
type TmwkRecord = {
  id: string // 'pref_' or 'note_' plus 8 hex chars, regenerated on collision
  kind: 'preference' | 'note'
  text: string // the user's words
  project: { repoId: string; name: string } | null // null means global
  source: string | null // a sourceId or a free reference
  createdAt: string // ISO 8601
  supersedes: string | null
  supersededBy: string | null
  retiredAt: string | null
}
```

A record is in effect when `supersededBy` and `retiredAt` are both null. Storage keeps every record. "Replaced in place" (M1 guide) describes the injected view only.

**Rules the store enforces:**

- `supersedes` must name a record of the same kind that is in effect. Otherwise the call fails with `tmwk_record_not_effective`.
- A supersede writes the new record and marks the old one in one atomic file write.
- Length limits (proposed, tune in dogfooding): a preference is at most 300 characters, a note at most 1,000. Over the limit fails with `tmwk_text_too_long`. A rule should be short enough to drop whole.
- No inference. A record exists only when the user stated it and the partner saved it (VISION non-goal: learning preferences).

**Writes.**

- Every handler runs in the home runtime. One in-process promise queue serializes read-modify-write per file.
- Write with `writeFileAtomically(path, json, { mode: 0o600 })`. Create `storeDir` with mode `0o700` on POSIX.
- A file that fails to parse, or has an unknown `version`, makes reads and writes fail with `tmwk_store_corrupt` and the path. The store never overwrites it.
- Two runtimes sharing one `root` on the same machine (a desktop and an `orcad`) are not supported. See [Risks](#risks).

**Migrations.** Deferred. `version: 1` only. A later version bump needs a migration step before any new reader.

## CLI surface

All commands are Own, under `src/cli/tmwk/**`. Each takes `--json`, which prints the RPC envelope as other `orca` commands do. Each runs against whichever runtime the CLI targets (`--environment`, `ORCA_ENVIRONMENT`). A non-home runtime answers `tmwk_not_home_host` with a message that names `--environment`.

| Command                                                                                                                                      | Output (plain)                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orca tmwk preference set <text> [--project <selector>] [--supersedes <id>]`                                                                 | `Saved pref_7f3a9c12 (global).` With `--supersedes`, a second line `Replaced pref_1b2c3d4e.`                                                                                                           |
| `orca tmwk preference list [--project <selector>] [--history]`                                                                               | The briefing block, below. `--project` shows global plus that project. `--history` adds retired and superseded records with `(replaced by <id>)` or `(removed)`.                                       |
| `orca tmwk preference remove <id>`                                                                                                           | `Removed pref_7f3a9c12.`                                                                                                                                                                               |
| `orca tmwk note save <text> [--project <selector>] [--source <ref>]`                                                                         | `Saved note_9d8e7f60.` `--source` takes a `sourceId` from `history search` or any short reference, such as a URL.                                                                                      |
| `orca tmwk history search <query> [--project <selector>] [--ticket <taskId>] [--limit <n>]`                                                  | One line per hit: `<sourceId>  <kind>  <date>  <snippet>`.                                                                                                                                             |
| `orca tmwk history read <sourceId>`                                                                                                          | A header (kind, created, project, source, status) and the full body.                                                                                                                                   |
| `orca tmwk brief (--goal <text> \| --goal-file <path\|->) [--words <text>] [--project <selector>] [--evidence <sourceId>]... [--out <path>]` | The owner spec on stdout. With `--out`, the CLI writes it to the path (relative to its cwd, or absolute, Windows separators accepted) on the caller's machine, not the home host, and prints the path. |
| `orca tmwk tickets [--needs-me]`                                                                                                             | Compact cards, in needs-me order. See [Ticket acceptance](#ticket-acceptance).                                                                                                                         |
| `orca tmwk tickets accept <taskId>`                                                                                                          | `Accepted <taskId>.`                                                                                                                                                                                   |

The `preference list` plain format is the briefing block. One renderer serves `list`, `brief` and M3's per-turn block:

```
Standing preferences (3)
pref_a1b2c3d4  Never merge without asking me.
pref_e5f6a7b8  [demo-repo] Use pnpm, not npm.
```

`--json` shapes, which are the contract the CLI and tests rely on:

- `preference set`: `{ record, superseded: string[] }`.
- `preference list`: `{ records, partial: boolean }`.
- `history search`: `{ hits: [{ sourceId, kind, title, snippet, createdAt, project }], truncated }`.
- `brief`: `{ briefId, text, partial }`.

**sourceId scheme:**

| Prefix                   | Source                                | Read by                                                                    |
| ------------------------ | ------------------------------------- | -------------------------------------------------------------------------- |
| `pref:<id>`, `note:<id>` | The store                             | Store lookup.                                                              |
| `ticket:<taskId>`        | A ticket snapshot (W6)                | Store lookup.                                                              |
| `session:<opaque>`       | A conversation hit from `orca search` | The existing session read RPC. **(verify which returns transcript text.)** |

**Errors** are `RuntimeClientError(code, message)`, reported by `reportCliError`. Codes: `tmwk_not_home_host`, `tmwk_record_not_effective`, `tmwk_text_too_long`, `tmwk_store_corrupt`, `tmwk_brief_too_large`, `tmwk_unknown_source`. A runtime that predates the namespace answers `method_not_found`. Map it to a clear "update the server" error, as `src/cli/workspace-ports/ports.ts` does **(verify)**.

**RPC names**, all `permission: 'workspace'`:

- `tmwk.preferenceSet`, `tmwk.preferenceList`, `tmwk.preferenceRemove`;
- `tmwk.noteSave`;
- `tmwk.historySearch`, `tmwk.historyRead`;
- `tmwk.brief`;
- `tmwk.tickets`, `tmwk.ticketAccept`.

Paired clients hold `workspace` by default (`src/main/runtime/rpc/callers/rpc-caller-scope.ts`) **(verify)**, so a paired desktop can reach the store. The methods are not added to the mobile allowlist, so mobile should get "not available to mobile clients" **(verify)**.

## Ownership changes

Land these rows, patch-log lines and a decision-log line in the same PR as the code they cover.

| Path                                                                             | From  | To                     | Why                                                                                                                          |
| -------------------------------------------------------------------------------- | ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/tmwk/**`, `src/main/tmwk/**`, `src/shared/tmwk/**`, `resources/tmwk/**` | Own   | Own                    | No change in state, scope only. `main-home-paths.ts` gains `storeDir`.                                                       |
| `src/shared/rpc-contract/tmwk/**` (only if the W1 catalog spike needs it)        | Track | Extend, new files only | The catalog generator may only index params under `src/shared/rpc-contract/`. Decide in the W1 spike, before any file lands. |
| `config/ast-grep/rules/tmwk-no-orchestration-internals.yml` and its rule test    | Own   | Own                    | Add `src/cli/tmwk/**` to the `files:` of both documents (`typescript` and `tsx`), in the same PR as the first file there.    |
| `src/cli/specs/index.ts`                                                         | Track | Extend                 | One import and one spread: `...TMWK_COMMAND_SPECS`.                                                                          |
| `src/cli/dispatch/handler-group-manifest.ts`                                     | Track | Extend                 | One import and one entry: `TMWK_HANDLER_GROUP`.                                                                              |
| `src/main/runtime/rpc/methods/rpc-method-registry.ts`                            | Track | Extend                 | One import and one spread: `...TMWK_RPC_METHODS`.                                                                            |
| `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                        | Track | Extend                 | Generated. Run `pnpm generate:rpc-params-catalog`. Never hand-edit. On a merge conflict, regenerate.                         |

Patch-log lines to add:

- `src/cli/specs/index.ts`: spreads `TMWK_COMMAND_SPECS` so `orca tmwk` shows in help and validates its flags.
- `src/cli/dispatch/handler-group-manifest.ts`: lists `TMWK_HANDLER_GROUP`, which lazy-loads the tmwk handlers.
- `src/main/runtime/rpc/methods/rpc-method-registry.ts`: spreads `TMWK_RPC_METHODS` so the home runtime serves the `tmwk.*` namespace.
- `src/shared/rpc-contract/rpc-params-catalog.generated.ts`: regenerated entries for the `tmwk.*` methods.

Decision-log line, dated: "M2 (D5–D14): the CLI reaches the store through a `tmwk.*` RPC namespace; briefs are rendered by `orca tmwk brief` with no orchestration patch."

Not touched in M2:

- `src/main/runtime/orchestration/**`, including `worker-dispatch-preamble.ts` and `ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES`, which `brief` reads through `src/shared/orchestration/**`, which the gate allows;
- `src/cli/orchestration/**`;
- `src/cli/dispatch/remote-selection-scope.ts`;
- the mobile routing table `runtime-rpc-mobile-method-routing.ts`;
- the root help text files `root-help-text-primary.ts` and `root-help-text-secondary.ts`. `orca tmwk --help` works through group help **(verify)**. Whether the root list should name it is an [open question](#open-questions-for-the-owner).

## How preferences reach the partner and owners

This is finding 8 of the M0 findings. The partner prompt is static by design. Three paths carry preferences.

| Reader                       | Path                                                                                                                   | Freshness              | Enforced?                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| The partner, in conversation | The prompt tells it to run `orca tmwk preference list` before it creates a ticket, sends to an owner, or acts outward. | Always current.        | No. It is a prompt rule.            |
| An owner                     | `orca tmwk brief` embeds the preferences in the task spec, which the dispatch preamble delivers after `=== TASK ===`.  | Current at brief time. | No. It is delivery, not permission. |
| The partner, per turn (M3)   | The same briefing renderer, in a per-turn block.                                                                       | Current each turn.     | No.                                 |

Owners run with `--dangerously-skip-permissions` (finding 8), so nothing bounds them except the brief. "Enforcement point" in main-chat.md means the one place preferences are delivered. It does not mean a permission check. This matches the no-fence rule for the partner.

**The briefing renderer.** `src/main/tmwk/briefing/render-preference-briefing.ts` is pure. It takes the records in effect, an optional project, and a character budget. It returns `{ text, partial }`.

- Order: global preferences first, then the matching project's. Within each, newest first.
- Budget: 2,000 characters for the block (proposed).
- A preference is dropped whole, oldest first, never cut mid-rule.
- Any drop appends one fixed line: `Briefing is partial: some standing preferences did not fit. Ask the partner before any outward or irreversible action.`

**The owner brief.** `src/main/tmwk/briefing/render-owner-brief.ts` is pure. It renders a fixed layout:

```
## Goal
<goal>

## The user's words
<words, when given>

## Standing preferences
<briefing block>

## Evidence
### <sourceId>
<excerpt>
```

- Owners never get the partner's notes automatically. Evidence is only what the partner cites with `--evidence`, and it may be a note. That settles the boundary between "cited evidence" and notes.
- Evidence excerpts are cut at 1,500 characters each and 6,000 in total (proposed). A cut adds the same partial line.
- The total must fit `ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES`. If the goal and words alone exceed it, `brief` fails with `tmwk_brief_too_large`.
- The brief has no reporting section. The dispatch preamble (`worker-dispatch-preamble.ts`, Track) already tells owners about `ask` and `worker_done`, and a second copy would drift.
- Preferences for a project appear only when `--project` names it. Global preferences always appear.

**Conversational change.** The user changes a preference by talking to the partner. The prompt (W5) tells the partner to:

- save a standing rule in the user's words with `preference set`;
- replace a changed rule with `preference list`, then `preference set ... --supersedes <id>`;
- drop a rule with `preference remove <id>`;
- say in one line what it saved;
- ask when it is unsure whether an instruction is standing or one-off. It does not infer rules.

**Existing pinned sessions.** A pinned main session read its prompt at launch. The new prompt reaches it only after a new session starts, which is M3's rollover. First-turn-prompt agents never refresh it. Until then, the partner works with the M1 prompt and has no `orca tmwk` instruction. Dogfooding on a fresh profile avoids this.

## Ticket acceptance

This is finding 4, with finding 5 as the reason the store holds history.

Orca has no "accepted by the user" state for a Task, and it deletes a Run 24 hours after it settles. So `tmwk.tickets` merges live orchestration state with `store/tickets.json`.

1. `tmwk.tickets` reads live tasks, runs and open decisions through the orchestration runtime RPC, called in process. The method names are **(verify)**. Start W6 by listing the RPCs behind `orca orchestration task-list`, `run` and gates. Do not import `runtime/orchestration`.
2. It upserts a snapshot per task: `{ taskId, runId, title, goal, status, result, completedAt, firstSeenAt, lastSeenAt, acceptedAt }`. A snapshot is never deleted, so a ticket outlives its Run.
3. It classifies each ticket and orders needs-me as: decisions, then stops, then results.

| Kind     | A ticket needs the user when                   |
| -------- | ---------------------------------------------- |
| Decision | An open decision gate or an `ask` is waiting.  |
| Stop     | The owner is blocked, failed or stopped.       |
| Result   | The task is complete and `acceptedAt` is null. |

`tickets accept <taskId>` sets `acceptedAt`. It fails with `tmwk_unknown_source` for an id with no snapshot. An accepted result drops out of `--needs-me`, and `tickets` without the flag still lists it. Until W6 ships, the prompt keeps treating every completed ticket as needing the user.

A snapshot is written only when `tickets` runs. If nothing calls it before the Run is deleted, the history is lost. W6's prompt edit tells the partner to call `tickets` on every wake. M3's notice queue closes the gap.

## Build order

W1 first, the day M1 merges. Rebase on merged M1 and re-check [Preconditions](#preconditions-from-m1) before opening it. W3 follows W2, W4 follows W3, and W5 follows W4. W6 is stretch: it can start after W1, and its prompt edit lands after W5. Each step is one reviewable PR.

### W1. Gate scope, CLI group and `tmwk.*` skeleton

A walking skeleton: `orca tmwk preference list` works end to end and returns an empty list. It also settles the unknowns that gate everything else.

Add:

- `src/cli/tmwk/tmwk-command-specs.ts`: `TMWK_COMMAND_SPECS`, built as `src/cli/specs/ports.ts` builds its spec (`path`, `summary`, `usage`, `allowedFlags` from `GLOBAL_FLAGS`, `examples`).
- `src/cli/tmwk/tmwk-handler-group.ts`: `TMWK_HANDLER_GROUP`, mirroring `src/cli/linear/linear-handler-group.ts`.
- `src/cli/tmwk/preference-handlers.ts`: reads flags with `getOptionalStringFlag`, calls `client.call('tmwk.preferenceList')` and prints through `printResult`.
- `src/main/tmwk/rpc/tmwk-rpc-methods.ts`: `TMWK_RPC_METHODS`, which only aggregates the per-area method files (`preference-rpc-methods.ts` here, then `note-`, `history-`, `brief-` and `ticket-rpc-methods.ts` in later steps), each built with `defineMethod`. Add a `requireTmwkHomeHost()` guard.
- `src/shared/tmwk/rpc/tmwk-rpc-params.ts`: zod params.
- `src/shared/tmwk/tmwk-records.ts`: the record type and guard.

Change:

- `src/main/tmwk/main-home/main-home-paths.ts`: add `storeDir`.
- The gate rule, both documents, and its rule test: add `src/cli/tmwk/**`.
- The three Extend files from [Ownership changes](#ownership-changes), then regenerate the catalog.
- `docs/tmwk/fork-ownership.md`: rows, patch log, decision log.

Spikes to answer first, and record in this guide:

- Whether the catalog generator indexes params under `src/shared/tmwk/**`. If not, new files under `src/shared/rpc-contract/tmwk/` are a fallback. That is a new-file-only Extend row.
- Whether `orca tmwk --help` resolves without a root help edit.
- Whether the `tmwk.*` handlers run when `RpcDispatcher` is the Node `orcad` host.
- The `repo.*` method and selector shape W2 needs to resolve `--project`.
- Which RPC, if any, returns session transcript text for `history read session:` (W3).
- Whether any RPC edits a task spec after creation. If one does, revisit D6.
- Read `docs/agents-md-refs/cross-platform-support.md` before touching any path code. It was not read for this guide, so this guide does not yet claim cross-platform coverage.

Import cycle rule: `tmwk-runtime-rpc.ts` imports `ALL_RPC_METHODS` from the registry, and the registry will import `TMWK_RPC_METHODS`. A `tmwk.*` method file must never import `createTmwkRpc` at module top level. Import it lazily inside the handler body, or take an in-process caller from the handler context. Confirm with `pnpm tc` and one app start.

Acceptance:

- From an agent shell on the home host, `orca tmwk preference list --json` prints an empty `records` array.
- With `TMWK_HOME_HOST=0`, it fails with `tmwk_not_home_host`.
- A probe file under `src/cli/tmwk/` that imports `runtime/orchestration` makes `pnpm lint:ast-grep-gates` exit 1. Remove the probe.
- `pnpm verify:rpc-params-catalog`, `pnpm tc` and `pnpm test:ast-grep` pass.
- Run once against an `orcad` home, or mark **Not tested**.

Depends on: M1 merged.

### W2. Store and preferences

Add:

- `src/main/tmwk/store/tmwk-record-store.ts`: read, write, supersede, retire. It serializes writes, uses `writeFileAtomically` with `0o600`, creates `storeDir` with `0o700`, and refuses a corrupt or unknown-version file.
- `src/main/tmwk/store/repo-project-resolver.ts`: resolves `--project` through the in-process `repo.*` RPC (**verify** the method) into `{ repoId, name }`.

Change:

- `src/main/tmwk/rpc/preference-rpc-methods.ts`: `preferenceSet`, `preferenceList`, `preferenceRemove`.
- `src/cli/tmwk/preference-handlers.ts` and the specs: `set`, `list` and `remove` with the flags above.
- `src/main/tmwk/briefing/render-preference-briefing.ts`: the renderer. `preference list` uses it.

Acceptance:

- Set, supersede and list show only the new text. `list --history` shows both.
- The records survive an app restart: `cat $TMWK_HOME/store/records.json` and `preference list --json` match before and after a kill and relaunch.
- Superseding a record already replaced fails with `tmwk_record_not_effective`.
- A corrupt `records.json` is not overwritten.
- A project-scoped preference does not appear for another project.

Depends on: W1.

### W3. Notes and history

Add:

- `src/main/tmwk/history/search-tmwk-history.ts`: matches query terms against store records, superseded ones included and flagged. It also calls the existing session search RPC in process and merges the hits. `src/cli/session-search/search.ts` and `src/shared/ai-vault/search/ai-vault-search-client` show the call (`aiVault.searchSessions`). Read their params first.
- `src/main/tmwk/history/read-history-source.ts`: resolves a `sourceId` by prefix. For `session:` it needs a transcript read RPC. Which of `aiVault.*` or `agent.read` returns text is **unknown**. If none does, `history read session:...` returns the hit's metadata and snippet and says the transcript is not available through RPC. Record that outcome.

Change:

- `src/main/tmwk/rpc/note-rpc-methods.ts` (`noteSave`) and `history-rpc-methods.ts` (`historySearch`, `historyRead`).
- `src/cli/tmwk/note-handlers.ts` and `history-handlers.ts`, plus the specs.

Acceptance:

- A saved note with `--source` appears in `history search` with its source and can be read in full.
- A session hit and a store hit appear in one result list.
- `--ticket <taskId>` filters to store records whose `source` references that ticket. Linking session hits to tickets is **unknown** and not required.
- `history read` of an unknown id fails with `tmwk_unknown_source`.

Depends on: W2.

### W4. Owner brief

Add:

- `src/main/tmwk/briefing/render-owner-brief.ts`: the pure renderer from [How preferences reach the partner and owners](#how-preferences-reach-the-partner-and-owners).

Change:

- `src/main/tmwk/rpc/brief-rpc-methods.ts`: `brief`. It resolves each `--evidence` id through `read-history-source.ts` and checks the total against `ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES`.
- `src/cli/tmwk/brief-handler.ts`: reads `--goal` or `--goal-file` with `readTextOrFileFlag` from `src/cli/arguments/command-body-input.ts`. With `--out` it writes the text to the path itself.

Acceptance:

- `orca orchestration task-create --spec-file <path from --out>` followed by `worker-start` delivers a first turn that contains the preferences. Read it back from the owner with `orca agent read` (or the dispatch's worker read command) and save the transcript.
- A project-scoped preference appears only for its project.
- No note appears unless cited.
- An oversized brief fails with `tmwk_brief_too_large`.
- The same brief works for a folder workspace. It contains no branch or worktree wording.

Depends on: W2, W3.

### W5. Partner prompt

Change `resources/tmwk/main-partner.md` only:

- the conversational preference and note rules above;
- run `orca tmwk preference list` before creating a ticket, sending to an owner or acting outward;
- always create a ticket's spec with `orca tmwk brief`, then `task-create --spec` or `--spec-file`;
- save a lesson only when the user or the partner decides it is worth keeping. Owners propose lessons in their reports, and never write notes;
- find past work with `orca tmwk history search`, and say `orca search` where the prompt names the raw session search;
- keep the M1 rule that every completed ticket needs the user until accepted. W6 replaces it.

The bootstrap rewrites `CLAUDE.md` and `AGENTS.md` on the next start, because `writeMainHomeTransports` writes when content differs. Keep the text agent-neutral and the commands plain `orca tmwk ...`.

Acceptance: the M1 behavior checks still pass. Run each new prompt check twice (see the runbook). A miss is a prompt fix, not a pass.

Depends on: W4.

### W6. Tickets and acceptance (stretch)

Outside the done-when. Ship it in M2 only if the orchestration read RPCs turn out to be straightforward. Otherwise move it to M3.

Add:

- `src/main/tmwk/tickets/ticket-snapshot-store.ts`: `store/tickets.json`, with the same write rules as W2.
- `src/main/tmwk/tickets/needs-me-order.ts`: pure classification and ordering.
- `src/main/tmwk/tickets/read-live-tickets.ts`: the in-process orchestration RPC reads (names **verify**).

Change:

- `src/main/tmwk/rpc/ticket-rpc-methods.ts`: `tickets`, `ticketAccept`.
- `src/cli/tmwk/ticket-handlers.ts` and the specs: `tickets [--needs-me]` and `tickets accept <taskId>`.
- `history` search and read: add `ticket:` sources.
- `resources/tmwk/main-partner.md`: replace "every completed ticket counts until accepted" with the accept flow, and tell the partner to call `orca tmwk tickets` on every wake.

Acceptance:

- A completed task shows as a result in `tickets --needs-me`. After `tickets accept`, it no longer does, and plain `tickets` still lists it.
- A decision sorts before a stop, and a stop before a result.
- The snapshot is still readable with `history read ticket:<taskId>` after its Run is deleted. If the Run cannot be deleted by hand, mark **Not tested**.

Depends on: W1. The prompt edit depends on W5.

## First-class citizens

- **Cross-platform.** Resolve every path with `node:path` from `resolveMainHomePaths()`, which already handles `USERPROFILE` on Windows. The store creates no shell commands. `brief --out` avoids shell quoting and heredocs, which matters most on Windows. Modes `0o700` and `0o600` apply on POSIX only. The atomic writer handles the Windows rename and ACL retry. WSL: how the home path resolves for a CLI in WSL against a Windows desktop is **unknown**. Read `docs/agents-md-refs/cross-platform-support.md` before W1.
- **Remote hosts.** The store is on the home host and every access goes through RPC to it. The partner's own `orca` reaches the home runtime directly. A user on a laptop reaches a homelab store with `--environment <homelab>` or `ORCA_ENVIRONMENT`. Making the laptop CLI find the home host on its own is not designed and would touch `remote-selection-scope.ts` (Track). Owners may run on any host. A brief is plain text inside the task spec, so it travels, and owners never touch the store.
- **Mobile.** Mobile does not run the CLI. A phone user sets preferences by talking to the partner. `tmwk.*` is not in the mobile allowlist, which is fine for M2. A preferences UI on mobile would need that Track patch, and no M2 requirement names one.
- **Folder workspaces.** Scope is a project (repo, including `kind: 'folder'`), never a worktree. A brief names no branch. The partner supplies placement with `--worktree folder:<id>` on `worker-start`.

## Tests

Add tests only where a revert would fail them, with hardcoded expectations. The rules are in [test-antipatterns](../agents-md-refs/test-antipatterns.md).

| Test                                      | Layer                                                            | Fails if                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Set a preference, supersede it, then list | Main unit on the store, mkdtemp `TMWK_HOME`                      | The old text is in effect, the history is lost, or a replaced record can be replaced twice.                                                                        |
| A corrupt `records.json`                  | Main unit on the store                                           | A write overwrites the file instead of failing with `tmwk_store_corrupt`.                                                                                          |
| Preference overflow                       | Pure unit on the renderer, with a small literal budget passed in | A preference is cut mid-rule instead of dropped whole, the oldest is not dropped first, or the partial line is missing. Do not assert the production budget value. |
| The owner brief's inputs                  | Pure unit on the renderer                                        | A note appears without being cited, or another project's preference appears.                                                                                       |
| Needs-me order and acceptance (W6)        | Pure unit                                                        | The order is not decisions, stops, results, or an accepted result stays in the list.                                                                               |

Not added: CLI flag parsing, the plain-text output format, RPC wiring, the prompt text, or the gate scope. The runbook shows the wiring works. The gate scope is shown by the W1 probe.

## Validation runbook

This proves the done-when with CLI transcripts and screenshots, saved under `docs/tmwk/m2/`. Use M1's launch recipe: a clean `env -i`, `ORCA_BACKGROUND_LAUNCH=1`, a fresh `TMWK_HOME` and user data directory outside any Claude Code scratchpad, and CDP screenshots of the hidden renderer. Never call `show()` or `focus()`. Save each transcript as a text file next to its screenshot.

| #   | Check                                  | Evidence                                                                                                                                                                             |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | CLI from the partner's shell           | A transcript of `preference set`, `list`, and `list --json`.                                                                                                                         |
| 2   | Supersede keeps history                | A transcript of `set --supersedes`, `list`, `list --history`, and the `records.json` file.                                                                                           |
| 3   | Persistence                            | The same `list` after killing and relaunching the app with the same env.                                                                                                             |
| 4   | Conversational set                     | "Never merge without asking me." The partner runs `preference set` (`04-set.png`).                                                                                                   |
| 5   | Conversational change                  | "Merging docs-only PRs is fine now." The partner lists, then sets with `--supersedes` (`05-change.png`).                                                                             |
| 6   | Preferences reach an owner             | The partner creates a ticket through `brief`. The owner's first turn contains the preferences (`06-owner-brief.png`, plus the `brief` transcript).                                   |
| 7   | Project scope                          | A project preference appears in that project's brief and not in another's (transcripts).                                                                                             |
| 8   | Notes and history                      | `note save --source`, `history search` returns the note and a session hit, and `history read` shows both (transcript).                                                               |
| 9   | Budget                                 | Enough preferences to overflow the block. The brief carries the partial line (transcript).                                                                                           |
| 10  | Home-host guard                        | `TMWK_HOME_HOST=0` returns `tmwk_not_home_host`. Then, from a second runtime with `--environment`, run checks 1 and 3 against an `orcad` home. Mark **Not tested** if it cannot run. |
| 11  | Codex and one ACP agent as the partner | Repeat checks 4 and 6 with the pin's agent set to `codex`, then once with an ACP agent.                                                                                              |
| 12  | Preference honored later               | Set "Never merge without asking me." Start a fresh main session and ask the partner to merge something. It asks first (`12-honored.png`).                                            |
| 13  | Ticket acceptance (W6, stretch)        | A completed ticket appears in `tickets --needs-me`, `accept` removes it, and `history read ticket:<id>` still works (transcript). Not part of the done-when.                         |

Checks 4, 5, 6, 11 and 12 are judgment, not mechanism. Run each prompt twice. Record a miss as a prompt fix.

Teardown: kill the dev process by pid, `orca worktree rm` any owner worktrees, and `rm -rf` the scratch directories.

Before every push, run `pnpm check:changed`, `pnpm test:ast-grep`, `pnpm verify:rpc-params-catalog` and `pnpm tc`.

## Risks

- **The Extend patches touch fast-moving Track files.** The registry and the generated catalog are conflict magnets. Keep each patch to one import and one spread, and regenerate the catalog on a conflict instead of merging it. Repeated conflicts mean the path should move state (fork-ownership rule 4).
- **Preferences reach owners only if the partner calls `brief`.** Nothing enforces it. Mitigation: the prompt makes it mandatory, and the runbook checks it. A cheap detector is a marker line at the top of every brief, with `tickets` flagging tasks without it **(verify there is an RPC to read a task's spec)**. If the partner still skips it, fall back to the D6 Extend patch.
- **A pinned session keeps the old prompt.** See [How preferences reach the partner and owners](#how-preferences-reach-the-partner-and-owners). The M2 prompt reaches existing sessions only at rollover.
- **Pull is not guaranteed.** The partner can forget to run `preference list`. If dogfooding shows this, the per-turn block (M3) is the fix.
- **Ticket history can be lost.** A snapshot is written only when `tickets` runs, and Orca deletes a Run 24 hours after it settles. Mitigation in W6's prompt edit, and M3's notice queue. If W6 slips, ticket history waits for M3.
- **Two runtimes on one machine sharing a store.** An in-process queue does not serialize across processes. It is not supported. If it happens in practice, move the writes to `writeFileAtomicallyIfUnchanged`, the compare-and-swap writer.
- **Sync filesystem calls in the main process.** `writeFileAtomically` is synchronous. `check:main-sync-fs-ratchet` may object **(verify)**. The files are small.
- **`session:` reads may not exist as RPC.** W3 records the outcome. `history read` for sessions may be partial in M2.
- **Unverified M1 paths.** The `orcad` dispatcher and the M1 runbook checks that were skipped can fail M2 checks that look unrelated.

## Deferred to M3 and M4

M3:

- tickets and acceptance (W6): absorbed by [M3 W5](m3-implementation-guide.md#w5-ticket-snapshots-and-acceptance), which shipped `tickets`, `tickets accept`, `ticket:` history sources and the `--since` delta;
- the working summary and rollover, which also refreshes the prompt for pinned sessions;
- the "while you were away" message and the `tickets --since <version>` delta;
- the per-turn briefing block that carries preferences, date, host, tickets and open decisions;
- scheduled wakes with a deterministic precheck;
- agent switching (D13).

M4:

- the ticket-first sidebar overview.

Not scheduled:

- the ongoing-ticket scheduler (finding 6);
- an Own ticket list or crew panel, beyond the `tickets` CLI;
- migrating the store when the home host changes;
- a hard tool fence;
- learning preferences automatically (a VISION non-goal);
- a mobile preferences UI.

## Doc updates

Land these with the code, in the PR that causes each one:

- **main-chat.md, "CLI surface":**
  - `brief` takes `--goal`, not `<taskId>`, and says how it is delivered (W4);
  - add `preference remove` and `tickets accept` (W2, W6);
  - replace `orca session-search` with `orca search` (W3);
  - say the CLI reaches the store through a `tmwk.*` RPC (W1).
- **main-chat.md, "Memory and continuity":** records live in `store/records.json` and `store/tickets.json`, with the record shape (W2).
- **main-chat.md, M0 findings 4, 5 and 8:** point to the accept flow, the ticket snapshots and `brief`. Change "enforcement point" to say it is delivery, not a permission (W6, W4).
- **main-chat.md, "Status":** it still says "design". Update it when M2 lands.
- **fork-ownership.md:** the rows, patch-log lines and decision-log line in [Ownership changes](#ownership-changes), and the gate's `src/cli/tmwk/**` scope.
- **m1-implementation-guide.md, "Deferred":** mark the M2 items done, and move agent switching to M3.
- **`resources/tmwk/main-partner.md`:** the W5 and W6 edits.
- Run `pnpm exec oxfmt --write docs/tmwk/m2-implementation-guide.md` before committing this file.

## Open questions for the owner

1. **D5.** Is a `tmwk.*` RPC namespace, with three Extend patches and a regenerated catalog, acceptable?
2. **D6.** Is `brief --goal` acceptable in place of `brief <taskId>`? If the owner wants preferences enforced rather than delivered by a partner habit, should M2 take the Extend patch to `src/cli/orchestration/**` up front?
3. **D7.** Is pull enough for "preferences reach briefings" in M2, with push deferred to M3's per-turn block?
4. **D9.** Which project identifier is stable across hosts? A project registered on a worker host may have a different `repoId`. It is **unknown** here.
5. **D10 and D14.** Is the explicit `tickets accept` command right, and is W6 as a stretch step (slipping to M3 if needed) acceptable?
6. **D12.** Can `preference remove` be added to the documented surface?
7. Should `orca tmwk` appear in the root help text, which is a hand-written list in Track files?
8. Should a laptop CLI find the home host on its own? Today it needs `--environment`, and the fix touches `remote-selection-scope.ts`.
9. Are the proposed numbers right: 300 characters per preference, 1,000 per note, a 2,000-character preference block, 1,500-character evidence excerpts and 6,000 characters of evidence?
10. Does the home host's session history include conversations from worker hosts? That decides what `history search` can see for tickets run elsewhere. It is **unknown**.

## W1 spike results

- **Catalog and `src/shared/tmwk/**`**: not indexed. The generator indexes `src/shared/rpc-contract/**` plus shared files that a file under `src/main/runtime/rpc/` imports by relative path. Params in `src/shared/tmwk/` would land in `RPC_METHODS_WITHOUT_SHARED_PARAMS`. The fallback is taken: params live in `src/shared/rpc-contract/tmwk/tmwk-rpc-params.ts` (new-file-only Extend row). `src/shared/tmwk/rpc/` is not used.
- **`orca tmwk --help`**: resolves through group help from the spec paths. No root help edit.
- **`orcad`**: `RuntimeRpcState` and the desktop IPC both build `RpcDispatcher` from `ALL_RPC_METHODS`, so the handlers register on `orcad`. `orcad` is home only with `TMWK_HOME_HOST=1`. Not tested against a live `orcad`.
- **Error codes**: the dispatcher maps an unknown error code to `runtime_error`, and the passthrough lists are in Track files. Handlers throw `tmwk_<code>: <message>` and `callTmwk` in `src/cli/tmwk/tmwk-rpc-call.ts` restores the code. It also maps `method_not_found` to `incompatible_runtime` ("update the server"). Later steps reuse both.
- **`--project` (W2)**: `repo.list` returns `{ repos }` and `repo.show` takes `{ repo: <selector>, repoHostId? }`. Both are `workspace` permission RPCs. W2 can call `client.call('repo.show')` from the CLI, or resolve in the handler through `context.runtime.showRepo`.
- **Session transcript text (W3)**: `agent.read` (`{ id, limit? }`) returns `entries` for an Orca session id. `aiVault.searchSessions` hits are not Orca session ids, so confirm the id mapping in W3.
- **Task spec edits**: none. `orchestration.taskUpdate` takes only `status` and `result`. D6 stands.
- **Cross-platform**: `src/main/tmwk/main-home/main-home-paths.ts` only gained `storeDir = join(root, 'store')`. `cross-platform-support.md` was not read, so coverage is still not claimed.
- **Import cycle**: `tmwk.*` method files import only `defineMethod` from `core`, never `createTmwkRpc`. `pnpm tc` passes. One app start was not run.

## W3 results

- **Session read outcome**: `aiVault.searchSessions` hits are provider transcripts, not Orca session ids. Only a hit with `structuredSession` (an Orca-native chat) maps to `agent.read`, through `structuredSession.sessionId`. `history search` emits `session:orca:<id>` for those and `session:<agent>:<providerSessionId>` for the rest. `history read` returns the chat's recent entries (limit 100) for the first form. For the second it returns the agent and a "not available through RPC" body. No metadata or snippet is kept, because `read` has no query to search again.
- **In-process calls**: `tmwk.historySearch` reuses the functions behind `aiVault.searchSessions` (`searchSessionService`, `searchWithStructuredOwners`), and `tmwk.historyRead` reuses `resolveAgentConversation` and `readAgentConversation`. They are imported directly, not through a dispatcher. A session search failure or a non-`results` response leaves the store hits in place and the plain output says conversations were not searched.
- **`--project`** scopes session hits to the repo path (`filters.scopePaths`) and store hits to global plus that project.
- **`--ticket`** filters store records whose `source` contains the task id and skips session search.
- `history search --json` adds `status` to each hit (`in effect`, `replaced`, `removed`, null for sessions) and `sessionsSearched` to the result.

## W4 results

- **`brief` RPC**: `tmwk.brief` resolves each `--evidence` id with the same readers as `tmwk.historyRead` (`historySourceReaders`, exported from `history-rpc-methods.ts`). It checks UTF-8 bytes against `ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES` from `src/shared/orchestration`.
- **Size**: the renderer fails with `tmwk_brief_too_large` when the goal, words and preferences alone exceed the limit, or when the finished brief does. It does not shrink evidence to fit beyond the 1,500 and 6,000 character caps.
- **`briefId`** is `brief_<base36 timestamp>`. It is not stored.
- **`--out`** creates parent directories, then writes UTF-8 on the CLI machine and prints the path.
- **Not run**: the `task-create --spec-file` to `worker-start` to `agent read` acceptance transcript needs a live app and is left to the runbook.
