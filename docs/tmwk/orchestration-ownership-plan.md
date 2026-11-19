# Orchestration ownership plan: tmwk owns the work layer

This plan inverts how tmwk treats Orca's orchestration. Today orchestration is **Track**: tmwk reaches it only through the `orca` CLI and runtime RPC, and edits nothing inside it. Under this plan, tmwk builds and owns the **work layer**: tickets and their owners, reports, questions and decision gates, briefs and preferences, worker instructions and the orchestration skills, the away digest and acceptance. It builds that layer on Orca **primitives**: agent launch, messaging, session reads and host placement. Orca keeps how the app talks to agents: adapters, native chat, sessions and transcripts, terminals, the remote runtime and SSH, and mobile. tmwk calls orchestration's plumbing and replaces its product logic one piece at a time. Orchestration stops being a black box that tmwk can only extend.

This is the owner's "option 2". It was written on 2026-11-18 from a read of `origin/main` at `be3969dc18`, which has M1, M2, the agent switch and all of M3 (the M3 stack merged with PR #23), plus open PR #24 (the worker-subagents preamble line). No gate was run for this plan and nothing was launched. Every code reference was found by reading the code. Line counts are non-test lines (tests, `*test-fixture*`, `*.spec.ts` and `__tests__` excluded), counted with `wc -l`. Commit counts are from `git log --since=2026-10-18 origin/main`. Items marked **(verify)** were not run and must be checked before anything relies on them.

**Done when:**

- [fork-ownership.md](fork-ownership.md) describes the two domains (Orca's agent plumbing, tmwk's work layer). Every orchestration path is classified as one or the other.
- tmwk owns the worker instructions (the dispatch preamble) and the orchestration skills. Changing them is a tmwk edit, not an Extend patch.
- Tickets, reports, questions, decisions and acceptance are tmwk records. An Orca Run, Task or Dispatch is the execution attempt under a ticket, not the ticket itself.
- A weekly upstream sync still merges every Orca path cleanly. The only new review work is the upstream diff of the files tmwk adopted.

## The findings in short

1. **The product is small, and the plumbing is most of the code.** Of the 51,937 lines in `src/main/runtime/orchestration/**`, about 3,750 (7%) are the work model: Runs, Tasks, gates, questions, reports, the coordinator and the preamble. About 41,000 (79%) are plumbing: mail routing and delivery, worker custody, lifecycle, approvals, turn stops, transcripts, federation, and the database machinery. About 6,900 (13%) are mixed. See [What orchestration consists of](#what-orchestration-consists-of).
2. **The churn is in the plumbing too.** Over 30 days, `terminal-authority` had 74 commits, `mailbox` 47, `crew` 45 and `federation` 35. The work model had few: `coordinator` 5, `db/tasks` 6, `db/decision-gates` 3, `db/questions` 9 and `workers/reports` 7. Owning the work model costs little in sync conflicts. Owning the plumbing would cost a great deal.
3. **Orchestration is not a leaf module.** 227 production files outside it import it. 107 are its own RPC layer (`src/main/runtime/rpc/methods/orchestration/**`). The other 120 are terminals, workspaces, runtime construction, agent senders, sessions, native chat, IPC and persistence. Nearly all of them import plumbing, such as worker custody, the database facade, session lineage and mail routing. They do not import the work model. See [Who imports orchestration](#who-imports-orchestration).
4. **So tmwk should replace the work model beside orchestration, not inside it.** tmwk stops calling the product parts. It never deletes or rewrites them, because a deletion would conflict on every sync. Orca's orchestration stays whole and merges as-is. The only files tmwk takes over inside an orchestration path are the preamble, behind a one-file shim, and the skill texts.
5. **The seam mostly exists, with four gaps.** tmwk can launch, message, read and place agents through runtime RPC without importing orchestration (see [The seam](#the-seam)). The gaps: no supervised launch without a Run and a Task, no agent-sourced card outside orchestration mail, no change feed, and no list of questions.

## Preconditions

Before O1, confirm each of these still reads as written here.

| Interface                                                                                   | File                                                                                                                                           | What this plan does with it                                                                   | Re-check                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildDispatchPreamble(params: PreambleParams)`                                             | `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts` (251 lines)                                                        | O1 moves its text into tmwk and leaves a shim.                                                | Its callers are still `coordinator-task-dispatch.ts`, `legacy-remote/federation.ts`, `rpc/methods/orchestration/runs/dispatch-methods.ts` (3 sites) and `deliver-worker-dispatch-preamble.ts`.                                                        |
| `dispatchPreambleSendOptions`, `TERMINAL_REDISPATCH_PARAGRAPH`, `CHAT_REDISPATCH_PARAGRAPH` | same file                                                                                                                                      | Stay in the shim. They are delivery plumbing.                                                 | `turn-delivery/send-agent-turn.ts` and `coordinator.test.ts` import them.                                                                                                                                                                             |
| Dispatch prompt markers                                                                     | `src/shared/orchestration/workers/orca-dispatch-status-prompt.ts`                                                                              | The tmwk preamble must keep them. Track code parses them.                                     | `ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX` ("You are working inside Orca, a multi-agent IDE."), `Your task ID is:` and `=== TASK ===` are read by `agent-status-field-normalization.ts`, `agent-row-primary-text.ts` and `agent-message-display-text.ts`. |
| The skill bundle                                                                            | `skills/orchestration/SKILL.md`, `skill-stubs/orchestration.md`, `skill-guides/orchestration.md`, `skill-guides/orchestration/references/*.md` | O1 adopts them in place.                                                                      | `config/scripts/skills/bundle-generation/generate-bundled-skill-guides.mjs` still lists `orchestration` in `CANONICAL_GUIDE_NAMES` and `STUB_TOPICS`.                                                                                                 |
| Generated skill outputs                                                                     | `src/cli/skills/bundled-skill-guides.ts` (4,482 lines), `resources/skills/current-manifest.json`, `resources/skills/released-digests.json`     | Regenerated, never hand-edited.                                                               | `pnpm generate:bundled-skill-guides` and `pnpm generate:skill-bundle-manifest` still write them.                                                                                                                                                      |
| `createTmwkRuntimeClient(runtime)` → `{ rpc, subscribe }`                                   | `src/main/tmwk/main-session/tmwk-runtime-rpc.ts`                                                                                               | All in-process primitive calls. It adds `orchestrationContractVersion` for `orchestration.*`. | Still dispatches through `RpcDispatcher` with `caller: { kind: 'local-cli' }`.                                                                                                                                                                        |
| `callTmwk(client, method, params)`                                                          | `src/cli/tmwk/tmwk-rpc-call.ts`                                                                                                                | CLI-side composition in O2–O4.                                                                | Still maps `tmwk_<code>:` messages to `RuntimeClientError`.                                                                                                                                                                                           |
| Ticket snapshots                                                                            | `src/main/tmwk/tickets/` (`ticket-snapshot-store.ts`, `read-live-tickets.ts`, `refresh-ticket-snapshots.ts`, `needs-me-order.ts`)              | O2 turns snapshots into attempt observations under tmwk tickets.                              | Run filter is still objective `main`. The inbox read is still capped at 200.                                                                                                                                                                          |
| `sendMainNotice(rpc, sessionId, { subject, body })`                                         | `src/main/tmwk/notices/send-main-notice.ts`                                                                                                    | tmwk's one way to put text into the main chat. It is built on `orchestration.send`.           | Falls back to a `[tmwk]` user bubble.                                                                                                                                                                                                                 |
| The import gate                                                                             | `config/ast-grep/rules/tmwk-no-orchestration-internals.yml`                                                                                    | O0 widens it.                                                                                 | Still covers `src/cli/tmwk`, `src/main/tmwk`, `src/shared/tmwk` and `src/renderer/src/components/main-chat`.                                                                                                                                          |
| PR #24                                                                                      | `tykowale/worker-subagents`                                                                                                                    | Changes one preamble line as an Extend patch. O1 absorbs it.                                  | Merged or still open. See [D33](#decisions).                                                                                                                                                                                                          |

State this plan inherits:

- **The map has a merge defect.** `fork-ownership.md`'s "The map" holds two tables run together: the second header row sits inside the first. The two tables disagree on `src/shared/rpc-contract/tmwk/**` (Own in one, Extend in the other). The rewrite in [Proposed fork-ownership.md](#proposed-fork-ownershipmd) fixes this.
- **The M3 guide names a file that has been renamed.** It calls the settled-Run deleter `settled-run-retention.ts`. The code is `src/main/runtime/orchestration/db/maintenance/settled-run-retirement.ts`. The PR that adds this plan corrects the M3 guide.
- **No `upstream` remote in this clone.** `git remote -v` lists only `origin`. The sync machine must have `upstream` configured **(verify)**.
- **The partner drives orchestration by hand.** `resources/tmwk/main-partner.md` runs `run-list`, `run-create`, `run-use`, `task-create`, `worker-start`, `send`, `reply`, `gate-resolve` and `inbox`. tmwk main code calls `orchestration.send`, `runList`, `taskList`, `gateList` and `inbox` in process.

## What orchestration consists of

### `src/main/runtime/orchestration/**` (51,937 lines)

| Part                    | Paths                                                                                                                                              |  Lines |             Commits/30d | Kind     | What it is                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ----------------------: | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator             | `coordinator/` (DAG convergence, task dispatch, decision gates, escalation)                                                                        |    809 |                       5 | Product  | The coordinator loop: which Task runs next, deps, stale-base flags, refusals.                                                                                   |
| Runs                    | `db/runs/`, `db/coordinator-runs/`                                                                                                                 |  1,257 |                      16 | Product  | Run create, lookup, coordinator binding (`run-use`), coordinator mail routing.                                                                                  |
| Tasks                   | `db/tasks/`                                                                                                                                        |    500 |                       6 | Product  | Task store, status transitions, start claims.                                                                                                                   |
| Gates and questions     | `db/decision-gates/`, `db/questions/`, `mailbox/questions/`                                                                                        |    544 |               3 / 9 / — | Product  | Decision gates, question threads.                                                                                                                               |
| Reports                 | `workers/reports/`                                                                                                                                 |    394 |                       7 | Product  | Report admission, follow-up actions, failure escalation, attention context.                                                                                     |
| Worker instructions     | `workers/launch/worker-dispatch-preamble.ts`                                                                                                       |    251 |                       7 | Product  | The preamble every worker gets.                                                                                                                                 |
| Dispatch context        | `db/dispatch-context/`                                                                                                                             |  1,767 |                      31 | Mixed    | Settlement, completion epochs and the circuit breaker are plumbing. The follow-up plan and the task settlement rules are product.                               |
| Crew                    | `crew/`                                                                                                                                            |  5,135 |                      45 | Mixed    | The read model behind Orca's crew view and the agent graph. It is product presentation, but terminals, sessions and native chat read it (12 importers outside). |
| Addressing              | `addressing/` (party, caller identity, session lineage)                                                                                            |  1,003 |                      12 | Plumbing | Who an address means, and who is calling.                                                                                                                       |
| Mail                    | `mailbox/` (routing, senders, structured and terminal pointers, delivery hold, notifications), `db/messages/`                                      |  7,547 |                      66 | Plumbing | Delivering a message into a chat or a PTY, and waking it.                                                                                                       |
| Worker custody          | `terminal-authority/`                                                                                                                              |  3,487 |                      74 | Plumbing | Which terminal or session belongs to which Dispatch, and legacy recovery.                                                                                       |
| Worker lifecycle        | `workers/lifecycle/`, `approvals/`, `turn-stops/`, `transcripts/`, `archives/`, `turn-delivery/`, the rest of `workers/launch/`                    |  5,378 |                      44 | Plumbing | Liveness, approval forwarding, turn-stop reports, transcript reads, sending a turn, and the agent selector.                                                     |
| Dispatch records        | `db/worker-dispatch/`, `db/worker-terminal/`                                                                                                       |  3,985 |                 25 / 21 | Plumbing | Dispatch start, stop, abandon and settle, and terminal claims.                                                                                                  |
| Cross-host              | `federation/`, `legacy-remote/`, `legacy-remote-home/`, `db/federation/`, `db/remote-owned/`, `db/peer-runs/`                                      | 11,711 |                      56 | Plumbing | Workers and mail across paired servers.                                                                                                                         |
| Database infrastructure | `db/schema/` (migrations to v46), `db/maintenance/`, `db/legacy/`, `db/reset/`, `db/mutation-receipts/`, the `db/*.ts` root (facade, records, ids) |  8,158 | 30 (excluding the root) | Plumbing | SQLite, migrations, the `OrchestrationDb` facade, retention, mutation receipts.                                                                                 |

The database has 41 tables (from `CREATE TABLE` in `db/`, not counting `_new` and `_v` migration copies). Only `runs`, `tasks`, `decision_gates`, `question_threads` and `coordinator_runs` hold the work model. `messages`, `deliveries`, `dispatch_contexts`, `worker_dispatches`, `worker_terminal_*`, the federation tables, the receipt tables and the legacy tables are plumbing.

### Its RPC layer, `src/main/runtime/rpc/methods/orchestration/**` (15,768 lines, 237 commits/30d)

The map does not list this directory. It falls under "`src/main/runtime/**` (rest): Track". It is the second-most-churned orchestration code.

| Part              | Lines | Kind                                                                                                                                            |
| ----------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs/`, `gates/` |   932 | Product: `runCreate`, `runUse`, `taskCreate`, `taskUpdate`, `dispatch`, `gateCreate`, `gateResolve`, `reset`.                                   |
| `messaging/`      | 4,844 | Mostly plumbing (`send`, `check`, `inbox`, routing, replay). `ask-methods.ts`, `reply-method.ts` and `helper-question-answerer.ts` are product. |
| `worker/`         | 7,531 | Plumbing: start (admission, placement, launch, readiness), stop, release, output, fleet, follow-up.                                             |
| The rest          | 2,461 | Plumbing: access, structured workers, federation, crew streams, caller show.                                                                    |

`src/main/runtime/rpc/orchestration/**` (2,860 lines: callers, compatibility, mutations) is plumbing.

### The CLI, `src/cli/orchestration/**` (4,413 lines, 15 commits/30d), and `src/shared/orchestration/**` (2,886 lines, 25 commits/30d)

- Product: `runs/` (run and reset handlers), `tasks/`, `gates/`, `messages/question-handler.ts` and `ask-agent-view.ts`.
- Plumbing: `messages/` (send, check, inbox), `workers/`, `dispatches/`, `identity/` (caller handle, session caller flags, compatibility envelope), `recovery/`.
- `src/shared/orchestration/**` is wire types and shared constants for both kinds. tmwk may import it; it already imports `ORCHESTRATION_CONTRACT_VERSION`.

### Skills and guides

| Path                                                              | Lines | Commits/30d | Role                                                                                                                                     |
| ----------------------------------------------------------------- | ----: | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/orchestration/SKILL.md`                                   |    68 |           5 | The installed discovery stub. It loads the guide with `orca skills get orchestration`.                                                   |
| `skill-stubs/orchestration.md`                                    |    36 |           5 | The stub body. The generator composes it with `skill-stubs/_shared` blocks.                                                              |
| `skill-guides/orchestration.md`                                   |   124 |          22 | The coordinator and worker guide that `skills get` serves.                                                                               |
| `skill-guides/orchestration/references/*.md`                      |   186 |          22 | Five references: coordinator loop, topology, messaging and gates, placement, recovery.                                                   |
| `src/cli/skills/bundled-skill-guides.ts`                          | 4,482 |          42 | Generated from all guides by `generate-bundled-skill-guides.mjs`.                                                                        |
| `resources/skills/current-manifest.json`, `released-digests.json` |     — |           — | Generated install manifest, and every released skill digest (used to tell an unmodified install from a user edit) **(verify the role)**. |

The guide and the references are product: they say how a coordinator and a worker behave. The stub's CLI resolver, the generator and the install machinery (`src/main/skills/**`) are plumbing.

## Who imports orchestration

Found by resolving every relative import in `src/**` against `src/main/runtime/orchestration/` (227 production files, 102 test files).

| Importer area                                                                                                                                                                  | Files | What they import (most used first)                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----: | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/runtime/rpc/methods/orchestration/**`                                                                                                                                |   107 | Everything. This is orchestration's own front.                                                                                   |
| `src/main/runtime/terminal/**`                                                                                                                                                 |    32 | Worker custody (`terminal-authority/structured-sessions`, `release`, compatibility authority), mail routing, pointer PTY writes. |
| `src/main/runtime/workspaces/**`                                                                                                                                               |    16 | The database binding, crew operations, custody, lineage.                                                                         |
| `src/main/runtime/construction/**`, `orca-runtime.ts`                                                                                                                          |    11 | Wiring: the database, crew projections, federation, custody.                                                                     |
| `src/main/runtime/rpc/orchestration/**`                                                                                                                                        |    12 | Legacy compatibility, mutation receipts, callers.                                                                                |
| `src/main/runtime/agent-senders/**`                                                                                                                                            |     8 | Dispatch lineage, worker history, crew changes.                                                                                  |
| Sessions (`agent-session`, `session-tabs`, `session-graph`, `session-lifecycle`, `session-construction`, `agent-conversations`)                                                |    17 | Session lineage, custody, crew.                                                                                                  |
| `src/main/native-chat/**`                                                                                                                                                      |     2 | `structured-agent-session-registry.ts` and `agent-session-fork-marker-delivery.ts` read crew.                                    |
| `src/main/ipc/**`, `persistence/`, `ssh/`, `wsl/`, `workspaces/`, `external-conversations/`, `agent-launch/`, `opencode/`, `artifacts/`, `files/`, the RPC core and dispatcher |    22 | Errors, the database file, environment transport, custody.                                                                       |

Across the 120 importers outside the RPC layer, the most-imported modules are `terminal-authority/structured-sessions` (43 imports), `db/orchestration-db` (21), `orchestration-error` (19), `addressing/session-lineage` (14), `terminal-authority/release` (11) and `mailbox/routing` (11). All of these are plumbing.

The work model has almost no fan-in outside the RPC layer:

| Module                                             | Importers | Outside the RPC layer                                                   |
| -------------------------------------------------- | --------: | ----------------------------------------------------------------------- |
| `coordinator/`                                     |         4 | 0                                                                       |
| `db/runs/`                                         |         3 | 0                                                                       |
| `db/tasks/`, `db/decision-gates/`, `db/questions/` |         0 | 0. They are reached through the `OrchestrationDb` facade.               |
| `workers/reports/`                                 |        11 | 1 (`rpc/orchestration/compatibility/orchestration-legacy-lifecycle.ts`) |
| `worker-dispatch-preamble`                         |         2 | 0. The four callers sit inside orchestration and its RPC layer.         |
| `mailbox/questions/`                               |         3 | 1 (`terminal/lifecycle/floating-session-liveness.ts`)                   |
| `crew/`                                            |        13 | 12                                                                      |

**Where conflicts would move.** If tmwk edited the work model in place, conflicts would land in the work-model files and in the RPC methods that call them (`runs/`, `gates/`, `messaging/ask-methods.ts`, `reply-method.ts`). Those churn little. If tmwk edited plumbing, conflicts would spread to the 120 Track importers above and to the most-churned directories. If tmwk edited `crew/`, they would reach native chat. This plan edits none of these. It leaves every orchestration file in place and merges it, except the preamble (behind a shim, in O1) and the skill texts (adopted, in O1).

Who calls tmwk today (the reverse direction): `chat-journal-startup.ts`, `core-runtime-activation.ts`, `rpc-method-registry.ts`, `src/cli/specs/index.ts` and `handler-group-manifest.ts`, one line each. This plan adds one more: the preamble shim.

## The seam

The seam is the set of Orca primitives tmwk calls. Main-process tmwk code calls them in process through `createTmwkRuntimeClient`. tmwk CLI commands call them from the CLI process through the runtime client, with the caller's own identity. Neither imports `runtime/orchestration`.

### Primitives tmwk can call now

| Need                       | Primitive                                                                                                                                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch an agent            | `agent.launch` (`src/shared/rpc-contract/agent-launch/agent-launch-params.ts`): `agent`, `target` (`existing` worktree, `create-worktree`, `create-folder-workspace`), `prompt { text, delivery }`, `surface`, `sessionId`, `operationId` for replay, `presentation` | Backed by `executeAgentLaunch` (`src/main/agent-launch/agent-launch-executor.ts`), which `worker-start` also uses. The agent it starts is not supervised: no Dispatch, so no lifecycle reports.                                                                                          |
| Launch a supervised worker | `orchestration.workerStart` (`orchestration-worker-start-params.ts`): `task` or `spec`, `run`, `from` (required), `worktree`, `repo`, `on`, `agent`, `model`, `effort`, `retryOf`, `setup`                                                                           | The only way to get approvals, turn stops, liveness and `worker_done` settlement. `from` must resolve to a real party: it sets the coordinator's worktree through `resolveDispatchCallerWorktreeId`. Whether tmwk can pass the pinned main session's address in process is **(verify)**. |
| Put work into a session    | `agentSession.send` (user role only: `SendBodyStructure` is `strict`, `role: 'user'`), `terminal.send`                                                                                                                                                               | No sender, no card.                                                                                                                                                                                                                                                                      |
| Message an agent as a card | `orchestration.send` with `to: orca_session_id:<id>`, a terminal handle, or `dispatch:<id>`                                                                                                                                                                          | The only path to `NativeChatAgentMessageCard` (M3 W1). Delivery, wake and PTY pointer writes are Orca's.                                                                                                                                                                                 |
| Read a session             | `agent.read`, `agentSession.history`, `agentSession.item`, `terminal.read`, `orchestration.workerRead`                                                                                                                                                               | `agent.read` reads Orca chats only, at most 100 shortened entries (M2).                                                                                                                                                                                                                  |
| Follow a session           | `agentSession.subscribeTurnCompletions`, `subscribeStatus`, `terminal.agentStatus`, `terminal.wait`                                                                                                                                                                  | Live streams, no replay (M3 W1).                                                                                                                                                                                                                                                         |
| Workspaces and placement   | `worktree.create`/`list`/`rm`, `folderWorkspace.*`, `repo.list`, `host.peerDesktops`, `workerStart --on <server>`                                                                                                                                                    | Cross-host placement exists only through `workerStart --on` or through the CLI's `--environment` routing.                                                                                                                                                                                |
| Read orchestration state   | `orchestration.runList`, `taskList`, `gateList`, `inbox`, `workerList`, `workerShow`, `dispatchShow`                                                                                                                                                                 | No `since` cursor (M3 D22).                                                                                                                                                                                                                                                              |
| A one-shot model call      | `runGenerationRequest` with `'tmwk-working-summary'` (Extend, M3 D28)                                                                                                                                                                                                | Used for summaries. O6 could reuse it for report digests.                                                                                                                                                                                                                                |

### Missing primitives

| Gap                                                       | Why it matters                                                                                                                                                                     | Plan                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1. A supervised launch without a Run or a Task.**      | `workerStart` needs a Task (from `--task`, or one it creates from `--spec`) in a Run. Approvals, turn stops, liveness and settlement are all keyed by Dispatch.                    | Keep the Run, Task and Dispatch as the **attempt** under a tmwk ticket (D35). tmwk owns one Run, `main`, and creates a Task per attempt. Revisit only if upstream adds a lighter primitive.                                                                                                                           |
| **G2. An agent-sourced card outside orchestration mail.** | `AgentMessageSource` (`src/shared/agent-session/journal/agent-session-message-source.ts`) carries an `orchestration` field, and `agentSession.send` accepts only user-role bodies. | Treat `orchestration.send` as the messaging primitive. It is plumbing, and tmwk calls it as today through `sendMainNotice`.                                                                                                                                                                                           |
| **G3. A change feed.**                                    | `taskList`, `gateList` and `inbox` take no cursor. tmwk diffs snapshots after each main turn, and Runs are deleted 24 hours after they settle (`settled-run-retirement.ts`).       | O2 makes tmwk records primary, so a missed diff no longer loses history. O7 checks `orchestration.crewSubscribe` (local-only, keyed by a party) as a signal **(verify what it emits)**. Otherwise it adds a Seam patch for a dispatch-change event.                                                                   |
| **G4. A list of questions.**                              | Orca has no list RPC for asks. M3 W5 scans the inbox (capped at 200) for `question` messages with no reply.                                                                        | O4: owners ask through `orca tmwk ask`, which records the question in the tmwk store before it calls `orchestration.ask`.                                                                                                                                                                                             |
| G5. A preamble extension point.                           | The preamble is a plain function with no hook.                                                                                                                                     | O1: a one-file shim.                                                                                                                                                                                                                                                                                                  |
| G6. Caller identity for in-process mutations.             | M3 found that `orchestration.send` from `'tmwk'` works once the contract version is set. `workerStart`, `taskCreate` and `runUse` resolve `from` or the caller to a party.         | O2–O5 compose mutations in the **CLI process** (`src/cli/tmwk`), where the caller's terminal or session identity is already resolved, by reusing `src/cli/orchestration/identity/*` (`resolveOrchestrationTerminalHandle`, `createOrchestrationCompatibilityEnvelope`) **(verify they can be reused without edits)**. |

## Decisions

Numbering continues from M3's D15–D30. **Owner call** means the recommendation changes a documented surface or the ownership map, and needs the owner's confirmation before its step starts.

| #   | Decision                               | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Owner call |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D31 | How the map is organized.              | By domain first. **Orca's domain** is how the app talks to agents: adapters, native chat, sessions and transcripts, terminals, remote runtime and SSH, mobile, and orchestration's plumbing. **tmwk's domain** is the work layer. Keep the state names Track, Extend and Own, which agents and the gate already use. Add a fourth state, **Adopted**: an upstream file tmwk has taken over at its upstream path. See [Proposed fork-ownership.md](#proposed-fork-ownershipmd).               | Yes.       |
| D32 | What "replace" means.                  | tmwk stops calling a product piece of orchestration. It never deletes, renames or rewrites it. Replaced pieces stay Track and keep merging, and other Orca users (any agent that loads the `orchestration` skill) still use them. Deleting would turn every upstream change to that file into a conflict.                                                                                                                                                                                    | No.        |
| D33 | Where the preamble text lives.         | In `src/main/tmwk/worker-instructions/render-worker-preamble.ts` (Own). `worker-dispatch-preamble.ts` becomes an **Extend shim**: it keeps `PreambleParams`, resolves `cli`, keeps `dispatchPreambleSendOptions` and the two redispatch paragraphs, and forwards to the tmwk renderer. PR #24's line moves into the tmwk renderer, and its patch-log entry is replaced by the shim's. If #24 has not merged when O1 starts, O1 carries the line itself and #24 closes.                       | Yes.       |
| D34 | How tmwk owns the orchestration skill. | **Adopt in place**: `skills/orchestration/SKILL.md`, `skill-stubs/orchestration.md`, `skill-guides/orchestration.md` and `skill-guides/orchestration/references/**` become Adopted. The skill keeps the name `orchestration`, so installs, renames and `orca skills get orchestration` keep working. The alternative, a separate tmwk skill beside an upstream one, would give agents two sets of instructions for the same commands.                                                        | Yes.       |
| D35 | What a ticket is.                      | A tmwk record in `store/tickets.json`: `{ id, title, goal, words, projectId, status, attempts: [{ runId, taskId, dispatchId, agent, host, startedAt, settledAt, outcome }], reports, questions, decisions, acceptedAt, version, changedAt }`. An Orca Task and Dispatch is one attempt, and a retry adds an attempt. The M3 snapshot becomes the attempt's observed state, so its history outlives the Run.                                                                                  | Yes.       |
| D36 | How owners report.                     | `orca tmwk report done\|failed\|blocked --ticket <id> --body ... [--evidence <path>]`. The CLI records the report in the tmwk store, then sends the matching `orchestration send --type worker_done\|escalation` with the caller's identity, so Orca's settlement, auto-close and liveness behave as today. Both happen in one command: if the record fails, nothing is sent. If the send fails, the report is kept and marked `unsent`, and the command prints the recovery.                | Yes.       |
| D37 | Questions and decisions.               | An owner asks with `orca tmwk ask`, which records the question and then calls `orchestration.ask`, so Orca still wakes the coordinator and delivers the reply. The partner answers with `orca tmwk answer <questionId>`, which records the answer and calls `orchestration.reply`. Decisions that need the user are tmwk records (`needs-me: decision`). tmwk stops using Orca decision gates, and `gate-resolve` leaves the partner prompt.                                                 | No.        |
| D38 | Who manages Run `main`.                | tmwk. On bootstrap and after a rollover or switch, tmwk makes sure Run `main` exists and is bound to the pinned session. `run-list`, `run-create` and `run-use` leave the partner prompt. In process, `orchestration.runCreate` and `runUse` act for the caller, which in process is `local-cli` **(verify that they can bind a session that is not the caller)**. Fallback: the briefing notice keeps its `run-use` line, as M3 D19 has it today.                                           | No.        |
| D39 | What the tmwk preamble says.           | Same sections and markers as upstream: `ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX` first, `Your task ID is:`, `=== CLI COMMANDS ===`, `=== AFTER YOU SEND worker_done ===`, `=== SUB-DISPATCH ===` and `=== TASK ===` last. Keeping them lets the five Track tests that assert on preamble text pass unchanged. From O3 on, the CLI recipes name `orca tmwk report` and `orca tmwk ask`. Upstream's CLI commands stay in the text as the fallback when a tmwk command is missing (an older host). | No.        |
| D40 | How Adopted files sync.                | Resolve with ours on every sync. Then read upstream's diff for those paths since the last sync (`git diff <last-sync-base>..upstream/main -- <adopted paths>`), and log each change as ported or declined in the sync PR. A changed CLI flag or command in upstream's skill is the signal to port it.                                                                                                                                                                                        | No.        |
| D41 | The import gate.                       | Keep `tmwk-no-orchestration-internals`. Extend it to also reject `runtime/rpc/methods/orchestration` and `runtime/rpc/orchestration` from tmwk paths. Add `src/main/tmwk/worker-instructions/**` to its files, which `src/main/tmwk/**` already covers. The shim is the one Track-side file that imports tmwk, and it is logged.                                                                                                                                                             | No.        |

## Build order

O0 first, then O1. O2 follows O1. O3, O4 and O5 follow O2 and can run in parallel. O6 follows O3. O7 follows O2. Each step is one reviewable PR against `main` on `origin`. No step edits a Track file except the O1 shim and the O7 fallback patch, if O7 needs it.

### O0. The new map

Change:

- `docs/tmwk/fork-ownership.md`: replace "States", "The map", "Changing a path's state", "Syncing with upstream" and "Guardrails" with [Proposed fork-ownership.md](#proposed-fork-ownershipmd). Keep the patch log and the decision log, and add the D31 decision-log line.
- `config/ast-grep/rules/tmwk-no-orchestration-internals.yml` (both documents): widen the regex to `(^|/)runtime/(orchestration|rpc/methods/orchestration|rpc/orchestration)(/|$)`.
- `config/ast-grep/rule-tests/tmwk-no-orchestration-internals-test.yml`: add one case for an import of `runtime/rpc/methods/orchestration`.
- `AGENTS.md`, tmwk section: add **Adopted** to the list of states.

Acceptance:

- `pnpm test:ast-grep` and `pnpm lint:ast-grep-gates` pass. The new case is rejected.
- The map is a single table, and every orchestration path in [What orchestration consists of](#what-orchestration-consists-of) appears in it.

Depends on: owner approval of D31.

### O1. Worker instructions and the orchestration skill move to tmwk

Add:

- `src/main/tmwk/worker-instructions/render-worker-preamble.ts`: `renderWorkerPreamble(input: WorkerPreambleInput): string`. `WorkerPreambleInput` is structural. It holds `PreambleParams` with `cli` already resolved to a string, so no orchestration type is imported. Move the text builders (`dispatchIdentityLines`, `checkLines`, `buildPostWorkerDoneInstructions`, `buildSubDispatchSection`, `buildOwnRunSubDispatchSection`, `buildDriftSection`) in unchanged, with PR #24's line. Import the markers from `src/shared/orchestration/workers/orca-dispatch-status-prompt.ts` and `ORCA_SESSION_ADDRESS_PREFIX` from `src/shared/agent-session/identity/orca-session-address-prefix.ts`.
- The redispatch paragraphs: the renderer needs them, and `send-agent-turn.ts` imports them from the shim. Define them in the tmwk file and re-export them from the shim.

Change:

- `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts` becomes the shim: the `PreambleParams` type, the `cli` resolution (`params.devMode ? 'orca-dev' : (params.cliCommand ?? 'orca')`), `export function buildDispatchPreamble(params) { return renderWorkerPreamble({ ...params, cli }) }`, `dispatchPreambleSendOptions`, and the re-exported paragraphs. Aim for 40 lines or fewer, and log it in the patch log.
- Mark the skill files Adopted: `skills/orchestration/SKILL.md`, `skill-stubs/orchestration.md`, `skill-guides/orchestration.md`, `skill-guides/orchestration/references/**`. Add one tmwk worker paragraph to `skill-guides/orchestration.md` under "If your prompt has a preamble…": use your own subagents and workflows freely, and follow the preamble's report commands. The wording matches PR #24.
- Regenerate: `pnpm generate:bundled-skill-guides` and `pnpm generate:skill-bundle-manifest`. Check whether `released-digests.json` must gain the new digest, so an installed tmwk skill counts as unmodified and still auto-updates **(verify in `generate-skill-bundle-manifest.mjs` and `bundled-skill-auto-update-eligibility`)**.
- `fork-ownership.md`: the shim's patch-log line replaces PR #24's line. Add the Adopted rows, and a decision-log line for D33 and D34.

Acceptance:

- `pnpm test src/main/runtime/orchestration/coordinator/coordinator.test.ts src/main/runtime/rpc/methods/orchestration/structured-workers/orchestration-worker-mode-opacity.test.ts src/main/runtime/rpc/methods/orchestration/structured-workers/orchestration-structured-worker-retry.test.ts src/main/runtime/rpc/methods/orchestration/worker/start/worker-start-composition.test.ts src/main/runtime/terminal/input/dsh-launch-prompt-resubmit.test.ts --maxWorkers=2` passes with no edits to those files.
- `pnpm verify:bundled-skill-guides`, `pnpm verify:skill-bundle-manifest`, `pnpm tc` and `pnpm test:ast-grep` pass.
- A live dispatch from the main chat shows the tmwk preamble with PR #24's line, and the crew row's primary text still shows the task, not the preamble (screenshot). `orca skills get orchestration` prints the adopted guide.
- `git diff origin/main -- src/main/runtime/orchestration` touches only the shim.

Depends on: O0.

### O2. tmwk tickets are primary

Add:

- `src/main/tmwk/tickets/ticket-store.ts`: `store/tickets.json` at version 2 (D35), using M2's write rules. A one-time migration turns each v1 snapshot into a ticket with one attempt. The guard keeps reading v1.
- `src/cli/tmwk/ticket-start-handler.ts`: `orca tmwk ticket start --goal ... --words ... --project ... --agent ... [--host <server>] [--worktree ...]`. In the CLI process it calls `tmwk.ticketCreate` (render the brief, store the ticket), then `orchestration.taskCreate` and `orchestration.workerStart` with the caller's identity and Run `main`, then `tmwk.ticketAttach` (`runId`, `taskId`, `dispatchId`). If `workerStart` fails, the ticket keeps an attempt with outcome `failed_start` and the receipt's `failedStage`.
- `orca tmwk ticket retry <ticketId>`: a new attempt with `--retry-of <dispatchId>`.
- `tmwk.ticketCreate`, `tmwk.ticketAttach` and `tmwk.ticketShow` RPCs. Params go in `src/shared/rpc-contract/tmwk/`.

Change:

- `refresh-ticket-snapshots.ts`: refresh the attempt state of each ticket with an open attempt. Runs whose Task is not attached to a ticket are still snapshotted as today, so tickets started by hand keep working.
- `resources/tmwk/main-partner.md`: "Create a ticket and start its owner" becomes one `orca tmwk ticket start`, and `brief` is called inside it.
- The `history` sources: `ticket:<id>` reads the tmwk record.

Acceptance:

- One `ticket start` creates a ticket, a Task and a Dispatch, and `orca tmwk tickets` lists the ticket with its attempt.
- After the Run is retired (dev hook or a manual `orchestration reset` in a scratch home), the ticket and its attempt history remain.
- A failed start leaves a ticket that `tickets --needs-me` lists as a stop.

Depends on: O1.

### O3. Reports are tmwk records

Add:

- `src/cli/tmwk/report-handler.ts`: `orca tmwk report` (D36). It resolves the caller's dispatch from the preamble's `--task-id` and `--dispatch-id`, which the tmwk preamble passes. It records through `tmwk.ticketReport`, then sends the orchestration message.
- `src/main/tmwk/tickets/ticket-report.ts`: `{ attempt, kind, body, evidence[], filesModified[], createdAt, sent }`.

Change:

- `render-worker-preamble.ts`: the finish and escalation recipes use `orca tmwk report`. Keep the `=== AFTER YOU SEND worker_done ===` heading (D39).
- `compute-away-digest.ts`, `render-ticket-changes.ts` and the `MainChatActivityPanel` data read report records instead of inbox bodies.
- `refresh-working-summary.ts`: a new report is a trigger (it replaces the `worker_done` inbox scan).

Acceptance:

- An owner's `orca tmwk report done` settles the Dispatch (`worker-show` reports settled) and stores the report. The main chat gets the usual card.
- With the runtime killed between the record and the send, the report is `unsent`, and rerunning the printed command sends it once.

Depends on: O2.

### O4. Questions and decisions

Add:

- `orca tmwk ask --ticket <id> --question ...` (owner) and `orca tmwk answer <questionId> --body ...` (partner), per D37.
- Question and decision records on the ticket.

Change:

- `read-live-tickets.ts`: drop the inbox scan for questions. Pending questions come from the store. Orca gates are still read for Runs not started by tmwk.
- The preamble's ask recipe, and the partner prompt's "Answer an owner's question" and gate lines.

Acceptance:

- A question asked with `tmwk ask` shows as a decision in `tickets --needs-me` without any inbox read. `tmwk answer` wakes the owner with the answer.
- A question asked with plain `orchestration ask`, as an older owner would, still appears, through the gate and inbox read kept for unattached Runs.

Depends on: O2.

### O5. tmwk owns Run `main`

Change:

- `src/main/tmwk/main-session/ensure-main-session.ts` and `replace-main-session.ts`: after the pin is written, make sure Run `main` exists and is bound to the pinned session (D38).
- `render-session-briefing.ts`: drop the `run-use` line once the bind is confirmed. Keep it as the fallback.
- `main-partner.md`: remove "Find the Run".

Acceptance:

- After a rollover, an owner's `worker_done` wakes the new session with no partner action. This is M3 runbook check 6, now without `run-use`.

Depends on: O2. Spike the D38 **(verify)** first. If binding another session in process is refused, stop and keep the briefing line.

### O6. Briefs and placement policy in the preamble

Change:

- `render-worker-preamble.ts`: a tmwk section above `=== TASK ===` with the owner brief's preference block, rendered by `render-owner-brief.ts`, so the brief is not mixed into the spec.
- `ticket-start-handler.ts`: choose the agent, host and worktree from preferences when the partner passes none (`defaultTuiAgent`, project host).

Acceptance: an owner started without `--agent` gets the preferred agent, and its preamble shows the preference block once.

Depends on: O3.

### O7. A change feed

Spike `orchestration.crewSubscribe` from `createTmwkRuntimeClient` for the main session's party. If it emits on every dispatch state change, refresh ticket attempts on each frame instead of after main turns. If not, write a one-hook Extend patch: an event emitter in the dispatch settlement path that tmwk subscribes to, logged in the patch log. Choose the smallest file **(verify which)**.

Acceptance: a ticket's status changes in `orca tmwk tickets` within 5 seconds of `worker_done`, with no main-session turn.

Depends on: O2.

## How upstream syncs work under the new map

| Path kind                                                                                                                                 | On sync                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track (Orca's domain), including all of `src/main/runtime/orchestration/**` except the shim, the RPC layer and `src/cli/orchestration/**` | Merges as-is. A conflict here means a tmwk edit leaked in. Revert it, or move the path to Extend and log it.                                                                                        |
| Extend, including the preamble shim                                                                                                       | Re-apply the patch from the log. If upstream changed `PreambleParams` or added a builder, the shim conflicts. Add the field to the shim and the tmwk renderer, and port any new section text (D40). |
| Adopted (the skill texts)                                                                                                                 | Resolve with ours. Read upstream's diff for those paths and log each change as ported or declined (D40).                                                                                            |
| Generated (`bundled-skill-guides.ts`, `current-manifest.json`, `released-digests.json`, `rpc-params-catalog.generated.ts`)                | Never hand-resolve. Take theirs, then regenerate. Take the union of `released-digests.json`, so stock Orca's digests stay known **(verify the generator's merge rule)**.                            |
| Own                                                                                                                                       | Never conflicts. A conflict means upstream added a file at our path, so rename ours.                                                                                                                |

**What still merges:** every Orca agent and host improvement, and all of orchestration's plumbing and its product code, which stays in the tree for non-tmwk use (D32).

**What stops merging:** the five skill-text paths, and the preamble's text. Upstream's preamble text changes arrive as shim conflicts and get ported by hand.

**Sync smoke check:** M0's delegation loop, now run through `orca tmwk ticket start` and `orca tmwk report done`. It must pass after every sync. Until it is automated, run it by hand and paste the transcript into the sync PR.

## First-class citizens

- **Cross-platform.** The preamble keeps its one-line recipes, which work in POSIX shells, PowerShell and cmd, per the upstream comment (STA-8200). New `orca tmwk` commands take `--body-file -` for long text, as `brief --goal-file` does, to avoid quoting on Windows. O1 must read `docs/agents-md-refs/cross-platform-support.md` before touching the CLI resolver text in the stub.
- **Remote hosts.** Owners on a paired server are started with `workerStart --on`. Their `orca tmwk report` runs on that server's CLI. tmwk RPCs answer only on the home host (`tmwk_not_home_host`), so a remote owner's report must reach the home host. Options: the CLI routes `tmwk.*` to the home host, or the report falls back to plain `worker_done` and the home host records it from the inbox. O3 decides **(verify how a remote worker's CLI reaches the home runtime)**. Until then, keep the preamble's fallback (D39).
- **Mobile.** No mobile change. Cards stay orchestration mail. `mobile/**` is Track.
- **Folder workspaces.** Tickets store worktree ids, not branches. `ticket start --worktree current` is valid in a folder workspace. `new-child` and `new-top-level` need a Git repo (placement reference).

## Tests

Add tests only where reverting the change would fail them, with hardcoded expectations. The rules are in [test-antipatterns](../agents-md-refs/test-antipatterns.md).

| Test                     | Layer                                                        | Fails if                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preamble markers         | Unit on `renderWorkerPreamble`, literal input                | The text does not start with "You are working inside Orca, a multi-agent IDE.", or lacks `Your task ID is: task_1` or `=== TASK ===` before the spec. |
| Shim forwards            | Existing Track tests (O1 acceptance)                         | Any of the five existing tests fails. No new test.                                                                                                    |
| v1 → v2 tickets          | Main unit on the store, mkdtemp `TMWK_HOME`, literal v1 file | A v1 snapshot is lost or gets two attempts.                                                                                                           |
| Report before send       | CLI unit with a fake runtime client                          | A send happens when the record failed, or a failed send drops the record.                                                                             |
| Questions from the store | Pure unit on needs-me ordering                               | A stored pending question is not a decision.                                                                                                          |

Not added: preamble wording, skill text, generated files, RPC wiring, the partner prompt. The runbook shows them.

## Validation runbook

Use M1's launch recipe: a clean `env -i`, `ORCA_BACKGROUND_LAUNCH=1`, a fresh `TMWK_HOME` and user data directory, and CDP screenshots of the hidden renderer. Save the evidence under `docs/tmwk/ownership/`.

| #   | Check                         | Evidence                                                                                                                                                            |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Preamble owned (O1)           | An owner's first item shows the tmwk preamble, and the crew row shows the task title (`01-preamble.png`).                                                           |
| 2   | Skill owned (O1)              | `orca skills get orchestration` output, and the installed `SKILL.md` digest matches the manifest.                                                                   |
| 3   | Sync rehearsal (O1)           | On a scratch branch, merge an `upstream/main` newer than this plan. Conflicts appear only in the shim, the Adopted files and generated files. Record the file list. |
| 4   | Ticket outlives Run (O2)      | Start, finish and accept a ticket, then retire its Run. `orca tmwk tickets` still lists it (transcript).                                                            |
| 5   | Report path (O3)              | `orca tmwk report done` from an owner: the card, the stored report, the settled Dispatch (`05-report.png`, `worker-show` output).                                   |
| 6   | Question path (O4)            | `orca tmwk ask` from an owner, then the partner's `tmwk answer`: the needs-me row, then the owner's resumed turn.                                                   |
| 7   | Rollover with no run-use (O5) | M3 check 6 with the briefing's `run-use` line gone.                                                                                                                 |
| 8   | Remote owner                  | Checks 5 and 6 with an owner on a paired server. Mark **Not tested** if none is paired.                                                                             |
| 9   | Codex owner                   | Checks 1 and 5 with `--agent codex`.                                                                                                                                |

Before every push, run `pnpm check:changed`, `pnpm test:ast-grep`, `pnpm verify:bundled-skill-guides`, `pnpm verify:rpc-params-catalog` and `pnpm tc`.

## Risks

- **The shim conflicts whenever upstream edits the preamble.** That was 7 commits in 30 days. Each conflict is small, but it needs a person to port the text. It is also the point: upstream's worker-behavior changes become visible instead of arriving silently.
- **Adopted skills drift from the CLI.** If upstream renames a flag and tmwk declines the diff, the skill teaches a dead flag. D40's review is the guard, and the CLI's retired-command recovery text (fork-ownership: "retired commands return recovery text") softens a miss.
- **Two apps, one skill install.** `config/electron-builder.config.cjs` still has `appId = 'com.stablyai.orca'`. If stock Orca and tmwk run on one machine, each may auto-update the installed `orchestration` skill over the other's **(verify where skills install and how the two builds tell each other apart)**.
- **Hidden dependence on the product code.** Plumbing may read work-model rows, for example a Task's status during settlement, or the follow-up plan in `db/dispatch-context/`. tmwk keeps creating real Tasks (G1), so nothing upstream sees changes. Do not skip Task creation to "own tasks".
- **Two sources of truth during the transition.** Between O2 and O4, some state is in tmwk records and some only in Orca. Each step's read path keeps the Orca read for Runs not started by tmwk.
- **Remote reports (O3).** If a remote owner's CLI cannot reach `tmwk.*` on the home host, D36's single command splits. The fallback is plain `worker_done` plus inbox ingestion, which is today's path.
- **Caller identity.** If D38's in-process bind is refused, O5 stops at the briefing line, as M3 has it today. No step depends on O5.

## Deferred

- Replacing mail delivery, worker custody, lifecycle or federation. These are Orca's domain.
- A supervised launch without a Task (G1). Track upstream, and propose it there if tmwk needs it.
- Replacing the crew panel. tmwk's M4 ticket-first sidebar is the tmwk view. The crew panel stays Orca's.
- Hiding tmwk's use of Orca Runs from Orca's own UI. tmwk's Run `main` stays visible in Orca's views.
- A tmwk-native scheduler for ongoing tickets (M0 finding 6) and scheduled wakes (M1 guide).
- Moving `src/cli/orchestration/**` out of Extend. It has no tmwk patch today, so propose Track in the map ([open question 5](#open-questions-for-the-owner)).

## Doc updates

Land these with the code, in the PR that causes each one:

- **fork-ownership.md:** the rewrite (O0), the shim patch line and Adopted rows (O1), and a decision-log line per step.
- **AGENTS.md:** the Adopted state (O0).
- **main-chat.md:** "tickets are Orca Tasks" becomes "tickets are tmwk records, with Orca attempts" (O2). Update "CLI surface" with `ticket start`, `ticket retry`, `report`, `ask` and `answer` (O2–O4). Remove "Find the Run" from the partner behavior (O5). Link this plan under "Milestones" (done in the PR that adds it).
- **README.md:** list this plan and the M3 guide, which was missing from the table (done in the PR that adds this plan).
- **m3-implementation-guide.md:** the `settled-run-retirement.ts` rename (done in the PR that adds this plan). D22's snapshot store is superseded by D35 (O2).
- **`resources/tmwk/main-partner.md`:** O2, O4 and O5.
- Run `pnpm exec oxfmt --write docs/tmwk/orchestration-ownership-plan.md` before committing.

## Open questions for the owner

1. **D31:** the domain split, and the name **Adopted** for the fourth state. Another name is fine. The rule matters more than the name.
2. **D33:** move the preamble text behind a shim, rather than adopting the whole file. Adopting it would avoid the shim but drop upstream's future signature changes silently. Should PR #24 merge first, as recommended?
3. **D34:** adopt the `orchestration` skill in place, or ship a separate tmwk skill and leave upstream's alone?
4. **D35/D36:** tickets as tmwk records with Orca attempts, and `orca tmwk report` wrapping `worker_done`. Is a one-command report the right owner experience, or should owners keep plain `worker_done` while tmwk reads it from the inbox?
5. **`src/cli/orchestration/**`:** the map has it as Extend, but there is no patch in it. Move it to Track?
6. **Order:** is O2 (tickets primary) the right next step after O1, or should O5 (hiding Run `main`) come first, because it is the most visible to the partner?

## Proposed fork-ownership.md

This replaces everything from "## States" to "## Extend patch log" in [fork-ownership.md](fork-ownership.md). The intro, the churn table, the patch log and the decision log stay. The intro's sentence "We also build tmwk's own product, the main chat, on top of Orca's orchestration" becomes "We also build tmwk's own product, the main chat and the work layer under it, on Orca's agent primitives."

---

### Two domains

**Orca's domain is how the app talks to agents.** It covers agent adapters, native chat, sessions and transcripts, terminals, the remote runtime and SSH, mobile, and orchestration's plumbing: mail delivery, worker launch, custody, lifecycle, approvals and federation. We merge it from upstream and do not edit it.

**tmwk's domain is the work layer.** It covers the main chat, tickets and their owners, reports, questions and decisions, briefs and preferences, worker instructions and the orchestration skill, the away digest and acceptance. We build it on Orca's primitives (agent launch, messaging, session reads, host placement), which we call through runtime RPC or the `orca` CLI.

Orca's orchestration also has a work model of its own: Runs, Tasks, gates, the coordinator. tmwk replaces it by no longer depending on it, never by deleting or editing it. It stays in the tree, merges as-is, and still serves agents that use the `orchestration` skill directly.

### States

| State       | Rule                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Track**   | Upstream's code. Make no local edits. Take every upstream change as-is. A needed fix goes upstream, or it becomes a deliberate move to Extend.                                                                                                                                  |
| **Extend**  | Upstream's code with small tmwk patches: registration lines, new flags, or a shim that forwards to tmwk code. Never restructure or rename. Each patch is small enough to re-apply by hand after a conflicting merge, and is listed in the [patch log](#extend-patch-log).       |
| **Adopted** | An upstream file tmwk has taken over at its upstream path. tmwk edits it freely. On sync, resolve with ours, then review upstream's diff of the file and log each change as ported or declined. Use it only where the path cannot move, because installs or generators name it. |
| **Own**     | tmwk's code under a `tmwk` or `main-chat` path. Upstream never touches it. It reaches Orca through runtime RPC or the `orca` CLI, never by importing `runtime/orchestration`, `runtime/rpc/methods/orchestration` or `runtime/rpc/orchestration`.                               |

### The map

A path that is not listed is **Track**.

| Path                                                                                                                                                                                                                             | Domain | State   | Notes                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/tmwk/**`                                                                                                                                                                                                                   | tmwk   | Own     | Product and design docs.                                                                                                  |
| `src/main/tmwk/**`                                                                                                                                                                                                               | tmwk   | Own     | Main session, home host, store, briefing, summary, tickets, reports, presence, worker instructions.                       |
| `src/cli/tmwk/**`                                                                                                                                                                                                                | tmwk   | Own     | `orca tmwk …`, including the ticket, report, ask and answer commands.                                                     |
| `src/shared/tmwk/**`, `src/shared/rpc-contract/tmwk/**`                                                                                                                                                                          | tmwk   | Own     | Shared types and `tmwk.*` RPC params (the catalog generator indexes `src/shared/rpc-contract/`).                          |
| `src/renderer/src/components/main-chat/**`                                                                                                                                                                                       | tmwk   | Own     | The main view. Composes `NativeChatView`; never patches inside it.                                                        |
| `resources/tmwk/**`                                                                                                                                                                                                              | tmwk   | Own     | The partner prompt and other runtime-loaded assets.                                                                       |
| `config/ast-grep/rules/tmwk-*`, `config/ast-grep/rule-tests/tmwk-*`                                                                                                                                                              | tmwk   | Own     | The import-boundary gate.                                                                                                 |
| `skills/orchestration/SKILL.md`, `skill-stubs/orchestration.md`, `skill-guides/orchestration.md`, `skill-guides/orchestration/references/**`                                                                                     | tmwk   | Adopted | The coordinator and worker guide. The skill keeps its name for installs and `skills get`.                                 |
| `src/main/runtime/orchestration/workers/launch/worker-dispatch-preamble.ts`                                                                                                                                                      | tmwk   | Extend  | A shim forwarding to `src/main/tmwk/worker-instructions/`.                                                                |
| `src/cli/skills/bundled-skill-guides.ts`, `resources/skills/current-manifest.json`, `resources/skills/released-digests.json`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                                          | both   | Extend  | Generated. Never hand-edit; on a conflict, take theirs and regenerate.                                                    |
| `src/cli/specs/index.ts`, `src/cli/dispatch/handler-group-manifest.ts`, `src/main/runtime/rpc/methods/rpc-method-registry.ts`                                                                                                    | Orca   | Extend  | One registration each for `orca tmwk` and `tmwk.*`.                                                                       |
| `src/main/startup/runtime-startup/chat-journal-startup.ts`, `src/main/backend/core-runtime-activation.ts`                                                                                                                        | Orca   | Extend  | One line each: start the tmwk home bootstrap.                                                                             |
| `config/electron-builder.config.cjs`, `config/scripts/orcad-distribution/server-bundle/build-orcad.mjs`                                                                                                                          | Orca   | Extend  | Ship `resources/tmwk`.                                                                                                    |
| `src/main/text-generation/source-control-text-generation-types.ts`, `src/main/text-generation/agent-generation-request.ts`, `src/main/text-generation/failures/source-control-agent-failure.ts`                                  | Orca   | Extend  | The `'tmwk-working-summary'` operation (M3 D28).                                                                          |
| `src/renderer/src/store/slices/ui/**`, `src/renderer/src/app-shell/**`, `src/renderer/src/components/sidebar/chrome/**`, `src/renderer/src/components/sidebar/worktree-list/listing/WorktreeList.tsx`                            | Orca   | Extend  | The `'main'` view, its mount and its sidebar entry.                                                                       |
| `src/shared/ui-chrome/ui-chrome-types.ts`, `src/shared/ui-chrome/top-level-view.ts`, `src/shared/rpc-contract/client-ui/client-ui-params.ts`, `src/renderer/src/components/right-sidebar/visibility/right-sidebar-visibility.ts` | Orca   | Extend  | Add `'main'` and hide the right sidebar on it.                                                                            |
| `src/renderer/src/i18n/locales/en.json`                                                                                                                                                                                          | Orca   | Extend  | `tmwk.mainChat` strings.                                                                                                  |
| `AGENTS.md`, `.gitignore`                                                                                                                                                                                                        | Orca   | Extend  | The tmwk section; the `docs/tmwk/` allowlist.                                                                             |
| `src/main/runtime/orchestration/**` (rest)                                                                                                                                                                                       | Orca   | Track   | Plumbing tmwk calls through RPC, and a work model tmwk no longer depends on (see "Two domains").                          |
| `src/main/runtime/rpc/methods/orchestration/**`, `src/main/runtime/rpc/orchestration/**`                                                                                                                                         | Orca   | Track   | Orchestration's RPC layer. The second-most-churned orchestration code.                                                    |
| `src/cli/orchestration/**`, `src/shared/orchestration/**`                                                                                                                                                                        | Orca   | Track   | The CLI contract tmwk calls. tmwk may import `src/shared/orchestration/**` and reuse `src/cli/orchestration/identity/**`. |
| `src/main/native-chat/**`, `src/renderer/src/components/native-chat/**`                                                                                                                                                          | Orca   | Track   | Most-churned code in the repo.                                                                                            |
| `src/main/claude/**`, `src/main/codex/**`, `src/main/acp/**`, other agent adapters, `src/main/agent-launch/**`                                                                                                                   | Orca   | Track   |                                                                                                                           |
| `src/main/orcad/**`, `src/main/daemon/**`, `src/main/ssh/**`, `src/main/runtime/**` (rest), `src/main/skills/**`                                                                                                                 | Orca   | Track   | Runtime, remote and headless hosts, skill install.                                                                        |
| `mobile/**`                                                                                                                                                                                                                      | Orca   | Track   |                                                                                                                           |
| Everything else                                                                                                                                                                                                                  | Orca   | Track   |                                                                                                                           |

### Changing a path's state

1. Update the row above.
2. Add a line to the [decision log](#decision-log) with the date and the reason.
3. Moving to **Adopted**: from then on, resolve that path with ours on the sync branch, and add it to the sync review list.
4. Moving to **Own**: move the code to a `tmwk` path, and leave a shim (Extend) at the old path if Track code imports it.

Signals that a path should move:

- An Extend path conflicts on most syncs. Upstream is reshaping it, so the patch either goes upstream or the path moves.
- tmwk needs product behavior the Track code will not have. Build it in Own beside the Track code and stop calling the Track version. Do not edit it.
- A Track path needs a local fix that upstream will not take. Move it to Extend.

### Syncing with upstream

Pull upstream weekly:

1. `git fetch upstream`, merge `upstream/main` into an `upstream-sync` branch, and open a PR to `origin/main`. Pushing to `upstream` is disabled.
2. **Track:** should merge clean. A conflict means a stray tmwk edit. Revert it, or log it as Extend.
3. **Extend:** re-apply each patch from the log. On a preamble shim conflict, add the new `PreambleParams` fields to the shim and the tmwk renderer, and port new section text.
4. **Adopted:** resolve with ours. Run `git diff <previous sync base>..upstream/main -- <Adopted paths>` and list each change in the PR as ported or declined.
5. **Generated:** take theirs, then run `pnpm generate:bundled-skill-guides`, `pnpm generate:skill-bundle-manifest` and `pnpm generate:rpc-params-catalog`.
6. Run `pnpm check:changed`, then the sync smoke check: one `orca tmwk ticket start` through `orca tmwk report done`, end to end (main-chat.md, Milestones).
7. Note any Extend path that conflicted. Repeated conflicts mean the path should move.

### Guardrails

- **Import boundary, enforced.** `tmwk-no-orchestration-internals` (`config/ast-grep/rules/tmwk-no-orchestration-internals.yml`) rejects imports of `runtime/orchestration`, `runtime/rpc/methods/orchestration` and `runtime/rpc/orchestration` from `src/cli/tmwk`, `src/main/tmwk`, `src/shared/tmwk` and `src/renderer/src/components/main-chat`. It runs in `pnpm lint:ast-grep-gates`.
- **Track never imports tmwk,** except the Extend lines in the patch log.
- **Naming:** tmwk code lives under a `tmwk` or `main-chat` path segment, so ownership is visible from the path alone. Adopted files are the only tmwk-owned files outside such a path, and the map lists every one.
