# M3 implementation guide: summary, rollover and the away message

This guide turns the M3 row of [main-chat.md](main-chat.md#milestones) into build steps. It was written on 2026-11-18 from a read of `main` at `4dfd4a7b06e` (M1 plus the merged agent switch, PR #10), the M2 stack on `origin/tykowale/m2-w5` (PRs #4, #5, #6, #8 and #9, rebased onto `4dfd4a7b06e` as `0034b3084b8` while this guide was being written), the [M0 findings](main-chat.md#m0-findings), and the Track code M3 touches: native chat sessions, context usage, orchestration mail and desktop presence. M2 is not merged. Re-verify [Preconditions](#preconditions-from-m2-and-the-agent-switch) against `main` before W1. No gate (`pnpm check:changed`, `pnpm tc`) was run for this guide, and nothing was launched. Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked before they are relied on.

**Done when:**

- long conversations roll over without visible loss;
- returning produces one accurate "while you were away" message.

"Without visible loss" has a testable meaning here. After a rollover, the new session answers "what were we doing?" from the working summary. A standing preference saved before the rollover is still applied. In-flight tickets still wake the partner. The main view says the conversation continued and links the earlier session (runbook checks 2, 6 and 7).

"Accurate" means the message is built from ticket state the tmwk store recorded, not from the partner's memory of its wakes. It lists exactly the needs-me items and finished tickets since the user was last present, in needs-me order (runbook checks 9 and 10).

## Preconditions from M2 and the agent switch

M3 builds on these interfaces. Before W1, confirm each one still reads as written here.

| Interface                                                                                         | File                                                                                                        | What M3 does with it                                                                                         | Re-check                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureMainSession({ rpc, home, pickAgent, replaceWithAgent? })`                                  | `src/main/tmwk/main-session/ensure-main-session.ts`                                                         | Becomes the one "start a new main session" path for switch and rollover (D16).                               | `replaceWithAgent` still mints a fresh `sessionId`, launches, writes the pin only after a successful launch, then calls `closeStrayMainSessions`.             |
| `tmwk.mainSession.get` and `tmwk.mainSession.switch` (`{ agent, expectedSessionId }`)             | `src/main/tmwk/main-session/main-session-methods.ts`, `src/shared/rpc-contract/tmwk/main-session-params.ts` | Switch gains the flush and the briefing. A `tmwk.mainSession.rollover` method joins them.                    | The stale-session refusal (`expectedSessionId`) and the same-agent no-op. The no-op must not apply to a rollover.                                             |
| `runMainSessionOperation(runtime, op)`                                                            | `src/main/tmwk/main-session/main-session-operations.ts`                                                     | Serializes bootstrap, switch, rollover and the away check per runtime.                                       | Still a per-runtime promise chain in a `WeakMap`.                                                                                                             |
| `MainSessionRecord = { sessionId, agent, createdAt }` and `isMainSessionRecord`                   | `src/shared/tmwk/main-session-record.ts`, `src/main/tmwk/main-session/main-session-pin.ts`                  | Gains an optional `previous` lineage (D16). The guard must keep accepting old pins.                          | The pin file is still `<root>/main-session.json`, written with `writeFileAtomically`.                                                                         |
| `closeStrayMainSessions(rpc, worktreeId, pinnedSessionId)`                                        | `src/main/tmwk/main-session/stray-session-reconciler.ts`                                                    | Closes the old session after the new pin is written. Runs on every bootstrap.                                | It calls `agentSession.close`, which keeps the record and journal. Whether the closed tab stays in `unifiedTabsByWorktree` is **(verify)**. W7 depends on it. |
| `needsFirstTurnPrompt(agent)`                                                                     | `src/main/tmwk/main-session/main-agent-selection.ts`                                                        | Unchanged. The static prompt keeps its transports. The briefing is a separate notice for every agent (D19).  | `claude` and `codex` still read files; every other agent still gets the prompt as its first turn.                                                             |
| `useMainChatSession()` and `MainChatView`                                                         | `src/renderer/src/components/main-chat/`                                                                    | The view shows only the pinned session. W7 adds the continuity strip.                                        | It still keys the surface on `pin.sessionId` and refetches `tmwk.mainSession.get` when the tab set changes.                                                   |
| `MainChatAgentSwitcher`                                                                           | `src/renderer/src/components/main-chat/MainChatAgentSwitcher.tsx`                                           | Gains a "saving context" state while the flush runs (D25).                                                   | It calls `tmwk.mainSession.switch` with a 120-second client timeout. A flush can take longer.                                                                 |
| The store: `createTmwkRecordStore(storeDir)`, `openTmwkStore()`, `storeDir = join(root, 'store')` | `src/main/tmwk/store/` (M2 W2)                                                                              | M3 adds `summary.json`, `tickets.json` and `presence.json` beside `records.json`, with the same write rules. | M2 merged. The in-process queue per path and the `tmwk_store_corrupt` refusal.                                                                                |
| `TMWK_RPC_METHODS`, `requireTmwkHomeHost()`, `tmwkError(code, msg)`, `callTmwk`                   | `src/main/tmwk/rpc/`, `src/main/tmwk/tmwk-error.ts`, `src/cli/tmwk/tmwk-rpc-call.ts` (M2 W1)                | New methods register through the same aggregate. Errors keep the `tmwk_<code>:` prefix.                      | The registry spreads both `TMWK_MAIN_SESSION_METHODS` and `TMWK_RPC_METHODS` (both present on the rebased `m2-w5`).                                           |
| `renderPreferenceBriefing(effective, projectId, budget?)` and `isRecordInEffect`                  | `src/main/tmwk/briefing/render-preference-briefing.ts` (M2 W2)                                              | The preference part of the session briefing and the context block.                                           | Still pure, still drops whole preferences and appends `PREFERENCE_PARTIAL_LINE`.                                                                              |
| `historySourceReaders(context).readOrcaSession(id)`                                               | `src/main/tmwk/rpc/history-rpc-methods.ts` (M2 W3)                                                          | Reads the old session for the fallback summary (D18).                                                        | It reads through `agent.read` with `limit: 100`, the RPC maximum (`AGENT_READ_MAX_LIMIT`). Entries are shortened, so it is a coarse view.                     |
| The W5 partner prompt                                                                             | `resources/tmwk/main-partner.md` (M2 W5)                                                                    | W8 adds the summary, rollover and away rules.                                                                | It has no summary, rollover or away rules. "Every completed ticket needs the user" still stands until M3 W5 replaces it.                                      |

M2 state M3 inherits. None of it is an M3 task, but each can break an M3 check:

- **M2 is a draft stack.** The five PRs are open. The stack was rebased onto `main` with the agent switch on 2026-11-18 (`4ccbdbcee79` formats `fork-ownership.md` after that rebase). Before the rebase, five files overlapped with the switch: `fork-ownership.md`, `main-chat.md`, `rpc-method-registry.ts`, the generated RPC params catalog and `ensure-main-session.test.ts`. On a conflict in the catalog, regenerate it with `pnpm generate:rpc-params-catalog`.
- **Runbook evidence.** `docs/tmwk/m2/` on `m2-w5` has transcripts and renders for checks 1, 2, 3, 6 (mechanism only, not the owner's first turn), 7, 8, 9 and the first half of 10. Checks 4, 5, 11 and 12, which need a live partner, have none. The `orcad` half of check 10 is recorded as not run. Check 12 (a preference honored in a fresh session) is the same bar as M3 check 2, so M3 may be its first real run.
- **W6 (tickets and acceptance) was not built.** There is no `tmwk.tickets`. M3 W5 absorbs it, because the away message needs ticket history that outlives a Run (D22).
- **M2 spike findings M3 relies on:** session text is readable only for Orca chats, through `agent.read`. No RPC edits a task spec, so D6 stands. `tmwk_unknown_project` was added. `tmwk.*` params live in `src/shared/rpc-contract/tmwk/`, because the catalog generator does not index `src/shared/tmwk/`. Method files never import `createTmwkRpc` at module top level.
- **Not run anywhere yet:** an `orcad` home, Codex delegation end to end, a paired phone.

After M2 merges, run `git log --oneline` on `main` and check that the files above exist. Then run `pnpm tc` and `pnpm test:ast-grep` on a clean checkout. If an interface changed, fix this guide first.

## What changes from main-chat.md

Fold these into main-chat.md when M3 lands. See [Doc updates](#doc-updates).

1. **No hidden turn exists.** main-chat.md and the M1 guide describe a "hidden pre-rollover flush turn". Orca's `agentSession.send` body (`SendBody` in `src/shared/rpc-contract/structured-agent-session/structured-agent-session-params.ts`) has no hidden or system flag, and the journal's `hidden` column is not client-settable. tmwk text in the main session is a **notice**: orchestration mail, which renders as an agent-sourced card, not a user bubble (D17). The flush is a visible, labeled notice.
2. **"Per turn" becomes "per wake".** No mechanism prepends context to each user turn. Claude's managed hooks only report status, and Codex's per-turn `developer_instructions` is sent as `null` by Track code. M3 attaches the context block to every tmwk notice and adds `orca tmwk context` for the partner to pull (D21).
3. **Rollover is triggered by tmwk, not the model.** tmwk reads context usage on the home host after each main-session turn and starts the rollover itself. The partner never decides to roll over, though the user can ask for it (D15, D27).
4. **"Since the user was last present" needs a tmwk presence record.** Orca persists no last-seen time. The desktop presence that gates phone notifications is private to `runtime-mobile-notification-controller.ts` and uses a 180-second threshold. M3 keeps its own (D23).
5. **The user sees an earlier-conversation link, not one merged transcript.** The main view renders one native session. "One continuous conversation" is a continuity strip plus a read-only view of the earlier session (D25).
6. **Ticket snapshots move from M2 W6 to M3.** See D22.
7. **The working summary is refreshed in the background, not written by the partner in a flush.** A one-shot, tool-less model call keeps it current, so a rollover never depends on a flush turn going well. The flush shrinks to "save any standing rule you have not saved" (D18, D28).
8. **A light "what's running" panel moves from M4 into M3** (D30). M4 keeps the ticket-first sidebar. M4 W3 removed the panel: the sidebar's ticket list replaces it.

## Prior art

M3 borrows from two earlier designs. Grenada is the predecessor app (`~/Developer/tmwk/grenada`). OpenClaw is an open-source agent gateway, read from its public docs on 2026-11-18.

| Area                    | OpenClaw                                                                                                                 | grenada                                                                                                                                                      | M3                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Long conversations      | Compacts in place at the smaller of 75% of the window and the window minus a summary reserve. No new session by default. | A new native session at 70% (`ROLLOVER_FRACTION` in `packages/core/src/rollover.ts`), between turns only.                                                    | A new session at 70%, between turns only (D15).                                           |
| Before the reset        | A silent memory flush on a private copy of the chat, appending to a daily note.                                          | None. The summary is already current.                                                                                                                        | A short flush for unsaved standing rules. The rollover does not wait on it (D18).         |
| Who writes the summary  | The compaction model.                                                                                                    | A one-shot, tool-less Haiku call (`prompts/working-summary.md`), refreshed after reports and decisions, 60-second debounce, input-hash dedup, while present. | A one-shot, tool-less call on the pinned agent, with grenada's triggers (D28).            |
| The new session's start | `MEMORY.md` plus today's and yesterday's daily notes.                                                                    | A deterministic briefing in the system prompt file.                                                                                                          | A deterministic briefing notice (D19).                                                    |
| While you were away     | No digest. Queued notices arrive on the next message or scheduled check.                                                 | Owner reports held while unfocused. One summary card on return after 10 minutes away, then a hidden turn.                                                    | One digest notice after 30 minutes away. Owner reports still wake the partner (D23, D24). |
| Background work         | A Subagents panel (Running and Finished, view-only transcripts).                                                         | Ticket cards grouped by what needs the user.                                                                                                                 | A "what's running" panel from ticket snapshots (D30).                                     |
| tmwk's own messages     | Hidden.                                                                                                                  | Hidden in the renderer, shown as cards.                                                                                                                      | Orca's existing mail card, collapsed by default (D29). Orca has no hidden send (item 1).  |

## Decisions

Numbering continues the fork-ownership decision log after M2's D5–D14. **Owner call** means the recommendation changes a documented surface or a Track path and needed the owner's confirmation. The owner confirmed D15 on 2026-11-18, decided D28–D30 the same day, and answered the rest after M3 was built (see [Owner answers](#owner-answers)); every answer matched what was built.

| #   | Decision                                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Owner call                       |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| D15 | What triggers a rollover.                 | Context usage, read by tmwk on the home host after each completed main-session turn. Call `agentSession.options({ sessionId })` in process and pass `contextUsage.current` to `selectStructuredAgentContextUsage([], current)` (`src/shared/agent-session/conversation-context/structured-agent-session-context-usage.ts`). Roll over at 70% of the window (owner confirmed on 2026-11-18; grenada's `ROLLOVER_FRACTION`), and earlier if the Claude report's `autoCompactAtTokens` is closer. An `estimate` counts. `unknown` (after a compaction or a model change) never triggers. Never mid-turn, and never while an approval or question is pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No.                              |
| D16 | One "start a new main session" path.      | Generalize `ensureMainSession`'s `replaceWithAgent` into `replaceMainSession({ agent, reason: 'switch' \| 'rollover', briefing })` in `src/main/tmwk/main-session/replace-main-session.ts`. A rollover may keep the agent. The pin gains `previous: [{ sessionId, agent, createdAt, endedAt, reason }]`, newest first, capped at 20. Both `tmwk.mainSession.switch` and the rollover call it, inside `runMainSessionOperation`. A failed launch leaves the old pin, as today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No.                              |
| D17 | How tmwk puts text into the main session. | A **notice**: in-process `orchestration.send` to the pinned session's Orca address, `type: 'status'`, `from: 'tmwk'`. The RPC handler defaults `from` to `'unknown'` and only the CLI raises `no_active_sender_terminal`, so this should work **(verify in W1)**. Structured chats receive mail through `structured-mailbox-pointer-delivery.ts` as agent-sourced cards. Fallback: `agentSession.send` with a user-role text block that starts `[tmwk]`, using the fence from `agentSession.history` and `computeAgentSessionPayloadFingerprint` (the pattern in `src/main/wsl/orcad/__tests__/wsl-orcad-chat-envelope.ts`). A truly hidden turn needs a native-chat patch (Track). Not taken.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Decided: visible cards are okay. |
| D18 | The flush turn.                           | Small and optional. A short notice to the old session: save any standing rule the user stated that `preference list` does not have, with `preference set`, then stop. Append-only: no supersede, no remove, no tickets, no outward action. Skipped when no user turn has happened since the last flush. The rollover waits at most 2 minutes for it and proceeds whatever the outcome, because the summary does not come from it (D28). It runs alongside the forced summary refresh. If the forced refresh fails, keep the old session pinned and retry after the next turn. After two failures, or at 90% context, roll over with a **fallback summary**: the last summary plus the old session's last 100 `agent.read` entries, marked `fallback`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided: the fallback summary.   |
| D19 | How the new session gets its briefing.    | A notice right after launch, for every agent, on rollover and switch. `render-session-briefing.ts` renders the latest summary, the preference block, the context block, and one line: bind Run `main` with `orca orchestration run-use` before any other orchestration command. The static prompt keeps its M1 transports. The very first session has no summary and gets no briefing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No.                              |
| D20 | Where the working summary lives.          | `store/summary.json`, `{ "version": 1, "summaries": [...] }`, with `{ id, text, sessionId, agent, reason: 'refresh' \| 'manual' \| 'fallback', createdAt, inputHash }`. Keep the newest 20. At most 4,000 characters each, over the limit fails with `tmwk_text_too_long`. A separate file, so `isTmwkRecord` stays strict and summaries never show in `preference list`. `history search` covers them as `summary:<id>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No.                              |
| D21 | The per-turn context block.               | Per wake, not per user turn. `render-context-block.ts` renders date and time, home host, the preference block, ticket counts and the needs-me list, and the summary's age. It is appended to every notice. `orca tmwk context` prints it, and the prompt tells the partner to run it at the start of a turn after a gap of an hour or more. Per-user-turn push is deferred, with the two candidates in [Deferred](#deferred).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided: enough for M3.          |
| D22 | Ticket history.                           | Absorb M2 W6. `store/tickets.json` holds a snapshot per task and a store-wide `version` counter. Every snapshot change sets `changedAt` to a new version. Snapshots are refreshed in process after each main-session turn, on return, and on each `tickets` call. No timer, no polling. Orca has no `updated_at` on tasks and no `since` on `taskList` or `gateList`, so tmwk diffs. `messages.sequence` is monotonic, but `orchestration.inbox` takes no cursor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided: M3 takes it.            |
| D23 | What "present" means.                     | The user is present when they send a turn in the main session (any client, including mobile), or when the desktop main view is visible and the OS is not idle. The renderer reports the second with `tmwk.presence.report` every 60 seconds. The user is away after 30 minutes with neither. Stored in `store/presence.json` as `{ lastPresentAt, awaySince, digestVersion }`. The mobile notification presence is not reused: it is private to a Track file and tuned for 180 seconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided: 30 minutes, no mobile.  |
| D24 | The away message.                         | On return, tmwk computes the digest from `tickets --since <digestVersion>` and the open needs-me list. Nothing changed: no notice. Otherwise one notice, and the partner turns it into one message: decisions, stops and results in that order, then what owners handled themselves, then a count still running. `digestVersion` advances only after the notice is accepted by `orchestration.send`. A return detected by a user turn queues the notice behind that turn **(verify the order)**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No.                              |
| D25 | What the user sees.                       | A strip above `NativeChatView` in the main view: "Continued from an earlier conversation · Show earlier". "Show earlier" opens the previous session read-only. During a switch, the switcher shows "Saving context…" until the flush and the forced summary refresh resolve. `tmwk.mainSession.switch` returns `{ state: 'pending' }` at once and the view refetches `tmwk.mainSession.get`, instead of a longer client timeout. Whether a closed session renders without resuming its provider is **(verify)**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided: the strip is enough.    |
| D26 | Whether a rollover can change the agent.  | Yes, through D16's `agent` argument, as main-chat.md's "Agent switch (M3)" requires. The automatic rollover keeps the pin's agent. A switch is a rollover with another agent, and its flush runs on the old agent. A switch never waits on a failed flush: it proceeds with the latest summary and says so in the briefing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | No.                              |
| D27 | A manual rollover.                        | `orca tmwk main rollover [--agent <agent>]`, through `tmwk.mainSession.rollover({ expectedSessionId?, agent? })`. It schedules the rollover for when the current turn ends and returns `scheduled`, so the partner can call it for "start fresh" without deadlocking its own turn. The runbook uses it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided: yes, and "start fresh". |
| D28 | Who keeps the working summary current.    | A background one-shot, after grenada (m3a §7). `src/main/tmwk/summary/refresh-working-summary.ts` runs a tool-less model call through Orca's text-generation path, `runGenerationRequest` (`src/main/text-generation/agent-generation-request.ts`), which structured chat naming already uses (`src/main/runtime/agent-session/naming/structured-chat-naming-runtime.ts`). It runs on the pinned agent, outside the main session: no tab, no turn in the chat. Input: the previous summary, the main session's entries since then through `historySourceReaders` (`agent.read`, at most 100), and ticket changes since the last refresh. Prompt: `resources/tmwk/working-summary.md`. Output: one summary of at most 4,000 characters, stored with reason `refresh`. Triggers: a ticket newly needs the user or is accepted, a gate or question is answered, context usage crosses 50%, and a forced run before every rollover and switch. Debounced 60 seconds, skipped when the input hash matches the last refresh, with backoff on failure. Runs only while the user is present (D23), except the forced run. Whether this needs a new `TextGenerationOperation` and `AiTextActionId` member (an Extend patch), and whether every agent the main chat supports can run it, is **(verify in W1)**. It always runs on the pinned agent (owner decision, 2026-11-18). An agent that cannot run it gets the fallback summary at rollover (D18). | Decided: the pinned agent.       |
| D29 | How notices look.                         | **Dropped** (owner decision, 2026-11-18). Notices use Orca's existing mail card, `NativeChatAgentMessageCard` (`src/renderer/src/components/native-chat/messages/rows/`), which already starts collapsed and shows one line: sender avatar, heading, sender, timestamp and a chevron. A custom label and icon would need an Extend patch on native chat, the most-churned Track code. W1's screenshot confirms the `from: 'tmwk'` heading. Revisit only if it reads badly, or if D17's `[tmwk]` user-bubble fallback is used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided: no patch.               |
| D30 | Seeing background work.                   | A "what's running" panel in the main view, pulled forward from M4. `MainChatActivityPanel.tsx` is collapsible and lists three groups from `tmwk.tickets`: Needs you (in needs-me order), Running, and Finished in the last 24 hours. Each row shows the title, owner agent, status and age. Clicking a row opens the owner's session through existing navigation **(verify)**. It refetches when opened, after each main-session turn, and every 30 seconds while visible. Each call refreshes snapshots (D22). Read-only in M3: accepting or stopping goes through the partner. M4 keeps the ticket-first sidebar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided: read-only in M3.        |

## How a rollover runs

All of it runs on the home host, inside `runMainSessionOperation`, in `src/main/tmwk/rollover/`.

1. **Observe.** `main-session-turns.ts` follows the pinned session's turns. The candidates are `agentSession.subscribeTurnCompletions({ includePrompts: true })`, whose events are `completion` (with `sessionId`, `turnId`, `outcome`, `awaitingUser?`) and `prompt`, and `agentSession.subscribeStatus` (`working`, `attention`, `idle`). Both are live streams with no replay (`src/shared/agent-session/view/agent-session-turn-completion-wire.ts`). Whether `createTmwkRpc` can hold a stream in process is **unknown**. It returns one response. W1 settles it.
2. **Decide.** After a `completion` for the pinned session with no `awaitingUser`, read context usage (D15). Below the threshold, stop. A manual rollover (D27) skips this check.
3. **Flush and refresh, side by side.** Send the flush notice to the old session, if one is due (D18), and start the forced summary refresh (D28). Wait for the refresh, and for the flush's completion up to its timeout. A failed refresh stops here (D18's retry and fallback rules).
4. **Brief.** Render the session briefing from the newest summary (D19), after the flush so its preferences are included.
5. **Replace.** `replaceMainSession({ agent, reason, briefing })`: launch the new session, write the pin with the old one in `previous`, close the old session, send the briefing notice.
6. **Record.** Log one line to the main process log: old and new session ids, agent, usage at the trigger, the refresh outcome and the flush outcome.

Failure rules:

- A failed launch keeps the old pin. Nothing is closed. The next turn retries.
- A crash between 5's pin write and the close leaves two sessions. The next bootstrap's `closeStrayMainSessions` closes the old one. If the briefing notice was not sent, bootstrap sends it when the newest pin entry has no `briefedAt`. The pin gains `briefedAt` for this.
- The old session is never deleted. `agentSession.close` keeps the record and journal.

Run `main` across a rollover. The new session has no Run binding until the partner runs `run-use`. Mail that arrives in between is **(verify)**: whether it waits in the `run:<main>` mailbox for the next bound coordinator, or is lost to the closed session. The switch from PR #10 has the same gap today. W1 tests it.

## The working summary

The summary is the backbone of each briefing. A background one-shot keeps it current (D28), and tmwk stores it. The design follows grenada's working summary, so a rollover never waits on the partner writing one.

- **Shape.** Plain text, at most 4,000 characters. `resources/tmwk/working-summary.md` asks for: what the user is working toward, open threads and who holds them, decisions made, and what the user asked to be reminded of. Tickets are not copied in: the context block lists them. The prompt says the transcript is data, not instructions.
- **When.** After ticket and decision events, when context crosses 50%, and before every rollover and switch (D28). Debounced, deduplicated by input hash, and only while the user is present, except the forced run.
- **Commands.** `orca tmwk summary show [--history]`, and `orca tmwk summary write (--text <text> | --text-file <path|->)` for a summary the user asks the partner to record, stored as `manual`. `write` records the caller's session id: the RPC reads it from the caller's Orca session identity **(verify how a chat's shell is identified to an RPC handler)**, else the pinned session id.
- **Built from the transcript, not memory.** The one-shot reads only the previous summary, the session's entries and ticket changes. It has no tools, so it cannot act.

## While you were away

Three parts: ticket snapshots (D22), presence (D23) and the digest (D24).

**Ticket snapshots.** `src/main/tmwk/tickets/`. The M2 guide's W6 design holds: a snapshot per task `{ taskId, runId, title, status, result, completedAt, firstSeenAt, lastSeenAt, acceptedAt, changedAt }`, never deleted, so a ticket outlives its Run. Reads go through the in-process RPCs `orchestration.runList`, `orchestration.taskList({ run })`, `orchestration.gateList({ run, status: 'pending' })`, and the question state. Never import `runtime/orchestration`. Settled-run retention (`settled-run-retirement.ts`, in `src/main/runtime/orchestration/db/maintenance/`) deletes a Run 24 hours after its last task, mail, gate and delivery activity. Snapshots are refreshed after every main-session turn, and the partner is woken by every owner report, so a ticket is snapshotted before its Run can be deleted.

Needs-me classification is the M2 one: a decision (open gate or pending question), then a stop (failed, blocked, or escalated), then a result (completed and not accepted). `tickets accept <taskId>` sets `acceptedAt`.

**Presence.** `src/main/tmwk/presence/presence-state.ts` is pure. Inputs are presence events with timestamps. Output is `present`, `away`, or `returned` (the first presence after away). Sources:

| Source                       | Signal                                                                                                                                       | Clients                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A user turn in the main chat | A `prompt` event from the turn stream (step 1 of the rollover) **(verify it fires for user turns, not only for prompts awaiting the user)**. | All, including mobile.             |
| The desktop main view        | `tmwk.presence.report({ visible: true })` from `MainChatView` every 60 seconds while the document is visible and the window focused.         | Desktop renderer, local or paired. |

The desktop OS idle reader `readDesktopAwayState(powerMonitor)` (`src/main/notifications/desktop-away-state.ts`) exists only on the Electron host, and an `orcad` home has no `powerMonitor`. So the renderer reports, and the home host does not read the OS.

**The digest.** `src/main/tmwk/away/render-away-digest.ts` is pure. Input: the snapshots changed since `digestVersion` and the open needs-me list. Output: `null` when nothing changed, else the notice text:

```
While you were away (since 14:05)
Needs you
- Decision: <ticket title>: <question>
- Result: <ticket title>: <result first line>
Handled by owners
- <ticket title>: completed and accepted earlier / retried / …
Still running: 2
```

The notice tells the partner to post exactly one message from it, in that order, and to say nothing more if the user has already moved on. The partner may not add items from its own memory.

## CLI surface

All commands are Own, under `src/cli/tmwk/**`, and follow M2's conventions: `--json` prints the envelope, a non-home runtime answers `tmwk_not_home_host`.

| Command                                                            | Output (plain)                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `orca tmwk summary write (--text <text> \| --text-file <path\|->)` | `Saved summary_3c4d5e6f.`                                                                   |
| `orca tmwk summary show [--history]`                               | The newest summary with its date, agent and reason. `--history` lists all kept.             |
| `orca tmwk context`                                                | The context block.                                                                          |
| `orca tmwk tickets [--needs-me] [--since <version>]`               | Compact cards in needs-me order. `--since` lists only snapshots changed after that version. |
| `orca tmwk tickets accept <taskId>`                                | `Accepted <taskId>.`                                                                        |
| `orca tmwk main rollover [--agent <agent>]`                        | `Rollover scheduled after this turn.`                                                       |
| `orca tmwk away --preview`                                         | The digest that would be posted now, without posting or advancing the watermark.            |

`--json` shapes:

- `summary write`: `{ summary }`.
- `context`: `{ text, partial }`.
- `tickets`: `{ version, tickets: [{ taskId, title, status, needsMe: 'decision' | 'stop' | 'result' | null, changedAt }] }`.
- `main rollover`: `{ state: 'scheduled' | 'running', sessionId }`.

**RPC names**, all `permission: 'workspace'`, params in `src/shared/rpc-contract/tmwk/`:

- `tmwk.summaryWrite`, `tmwk.summaryShow`;
- `tmwk.context`;
- `tmwk.tickets`, `tmwk.ticketAccept`;
- `tmwk.mainSession.rollover`;
- `tmwk.presence.report`, `tmwk.awayPreview`.

**Errors:** M2's codes plus `tmwk_rollover_busy` (a rollover or switch is already running) and `tmwk_session_changed` (the `expectedSessionId` refusal, which today throws a plain message).

## Ownership changes

M3 needs no Extend patch unless D28 needs a new text-generation operation id. Everything new is under `src/main/tmwk/**`, `src/cli/tmwk/**`, `src/shared/tmwk/**`, `src/shared/rpc-contract/tmwk/**`, `src/renderer/src/components/main-chat/**` and `resources/tmwk/**`.

| Path                                                                                              | From   | To                     | Why                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/shared/rpc-contract/rpc-params-catalog.generated.ts`                                         | Extend | Extend                 | Regenerated for the new methods. Never hand-edit.                                                       |
| `src/renderer/src/i18n/locales/en.json`                                                           | Extend | Extend                 | The continuity strip and switcher strings, under the existing `tmwk.mainChat` keys.                     |
| `src/main/text-generation/source-control-text-generation-types.ts` and the `AiTextActionId` union | Track  | Extend, only if needed | D28: a `tmwk-working-summary` operation id, if `runGenerationRequest` cannot run without one.           |
| The rest of `src/main/native-chat/**` and `src/renderer/src/components/native-chat/**`            | Track  | Track                  | Not touched. A hidden turn or a merged transcript would need them, which is why D17 and D25 avoid both. |

Decision-log line, dated: "M3 (D15–D30): tmwk triggers rollover from context usage, keeps the working summary current with a background one-shot, writes into the main chat only as notices, shows running work in the main view, and keeps summaries, ticket snapshots and presence in the tmwk store."

If W1 finds that a notice cannot be sent without a sender identity, the fallback (D17) needs no patch. If the turn stream cannot be followed in process, see the W1 fallback.

## Build order

W1 first. W2 and W5 can run in parallel after W1. W3 follows W2, W4 follows W3, W6 follows W5, W7 follows W3, W9 follows W5, and W8 follows W4 and W6. Each step is one reviewable PR. Notices carry their own instructions, so each step works before W8 updates the prompt.

### W1. Spikes, notices and the turn observer

Add:

- `src/main/tmwk/notices/send-main-notice.ts`: `sendMainNotice(rpc, sessionId, { subject, body })`, D17's primary path and its fallback behind one function.
- `src/main/tmwk/rollover/main-session-turns.ts`: follows the pinned session's turn completions and prompts, and re-subscribes when the pin changes.

Spikes to answer first, and record in this guide:

- Does `orchestration.send` with `from: 'tmwk'`, `type: 'status'` and `to` set to an Orca session address (`session-recipient.ts`) reach a structured chat as a card and wake it? Does it need `run`? Does a chat with no Run binding receive it?
- Can Own code follow `agentSession.subscribeTurnCompletions` in process? `createTmwkRpc` returns one response per call. If streams cannot be held, find the host-side subscription the RPC wraps and decide whether reading it from `src/main/tmwk` is acceptable. The gate allows it (it blocks only `runtime/orchestration`), but it couples Own code to native-chat internals. Record the choice.
- Does `agentSession.options` return `contextUsage.current` for Claude, Codex and one ACP agent when called in process? Record the shape for each.
- After `replaceMainSession`, does mail sent to `run:<main>` before the new session's `run-use` reach the new session?
- Does a `prompt` event fire for every user turn?
- Does a closed main session stay in `unifiedTabsByWorktree`, and can `NativeChatView` render it without resuming the provider (W7)?
- Can Own code call `runGenerationRequest` with the pinned agent and a prompt it renders, local and remote, without a new operation id? Which main-chat agents can run it? Record the answer for D28.
- Screenshot a `from: 'tmwk'` notice in the main chat. It should render as `NativeChatAgentMessageCard`, collapsed, with the generic heading (D29). Record the heading it gets.
- Read `docs/agents-md-refs/cross-platform-support.md`. Neither the M2 guide nor this one has.

Acceptance:

- `sendMainNotice` puts a card in the main chat and the partner answers it (screenshot).
- The observer logs one line per completed main-session turn, with its `sessionId`.
- `pnpm tc` and `pnpm test:ast-grep` pass.

Depends on: M2 merged.

### W2. Summary store and the briefing renderers

Add:

- `src/main/tmwk/store/tmwk-summary-store.ts`: `store/summary.json` with M2's write rules (in-process queue, `writeFileAtomically` with `0o600`, refuse a corrupt or unknown-version file), keeping the newest 20.
- `src/main/tmwk/briefing/render-session-briefing.ts` and `render-context-block.ts`: pure. Each takes its inputs and a character budget and returns `{ text, partial }`, as `renderPreferenceBriefing` does.
- `src/main/tmwk/rpc/summary-rpc-methods.ts` (`summaryWrite`, `summaryShow`) and `context-rpc-methods.ts` (`context`).
- `src/cli/tmwk/summary-handlers.ts` and `context-handler.ts`, plus the specs. `--text-file -` reads stdin through `readTextOrFileFlag`, as M2's `brief --goal-file` does.
- `src/main/tmwk/summary/refresh-working-summary.ts` and `resources/tmwk/working-summary.md` (D28), with the forced trigger and the 50% context trigger. W5 adds the ticket triggers.

Change:

- `history search` and `history read`: add `summary:<id>` sources.

Until W5 lands, the context block's ticket part is omitted with a fixed line saying so.

Acceptance:

- `summary write` then `summary show` round-trips, and survives an app restart.
- A 21st summary drops the oldest.
- `context` prints the date, the home host and the preference block.
- A forced refresh after a short main-chat exchange stores a `refresh` summary that names the exchange's topic, and no item appears in the main chat. A second forced refresh with no new entries is skipped.

Depends on: W1.

### W3. One new-session path, and the briefing on switch

Add:

- `src/main/tmwk/main-session/replace-main-session.ts`: D16. It reuses `ensureMainSession`'s launch and validation, so pull that into a shared `launchMainSession` instead of copying it.

Change:

- `MainSessionRecord` and `isMainSessionRecord`: optional `previous` and `briefedAt`. An old pin without them stays valid.
- `tmwk.mainSession.switch`: calls `replaceMainSession` with `reason: 'switch'` and sends the briefing notice. No flush yet. It returns `{ state: 'pending' }` once the work is queued (D25), and `tmwk.mainSession.get` reports `{ pin, agents, pending }`.
- Bootstrap: brief a pin entry with no `briefedAt`.
- `tmwk.mainSession.rollover` and `orca tmwk main rollover` (D27), without the flush.

Acceptance:

- A switch from Claude to Codex leaves a briefing card as the new session's first item, and the Codex partner can say what the summary says.
- A same-agent `main rollover` pins a new session and lists the old one in `previous`.
- Killing the app between the pin write and the briefing still ends with one briefed session after relaunch.

Depends on: W2.

### W4. The flush and the automatic trigger

Add:

- `src/main/tmwk/rollover/rollover-decision.ts`: pure. Inputs: context usage, the threshold, `awaitingUser`, the forced refresh outcome and the failure count. Output: `wait`, `prepare` (flush and refresh), `roll-over`, or `roll-over-with-fallback`.
- `src/main/tmwk/rollover/run-rollover.ts`: the sequence in [How a rollover runs](#how-a-rollover-runs).
- `src/main/tmwk/rollover/fallback-summary.ts`: the last summary plus the old session's `agent.read` entries through `historySourceReaders`.

Change:

- `tmwk.mainSession.switch` and `rollover`: run the flush first (D18, D26).
- `MainChatAgentSwitcher`: show "Saving context…" while `pending` (D25).

A test hook: `TMWK_ROLLOVER_PERCENT`, honored only when the app is unpackaged or under E2E, as `resolveTmwkRoot` treats `TMWK_HOME`. It exists so the runbook can trigger a rollover without a long conversation.

Acceptance:

- With `TMWK_ROLLOVER_PERCENT=5`, the second ordinary turn triggers a flush card, a summary with reason `refresh`, and a new session. Nothing happens mid-turn.
- A flush that times out does not hold the rollover.
- A forced refresh that fails keeps the old session pinned. A second failure rolls over with reason `fallback`.
- A switch whose refresh fails still switches, and the briefing says the summary may be stale.

Depends on: W3.

### W5. Ticket snapshots and acceptance

M2's W6 design, plus `--since` and the version counter (D22). If M2 shipped W6, this step only adds `version`, `changedAt` and `--since`.

Add:

- `src/main/tmwk/tickets/ticket-snapshot-store.ts`, `needs-me-order.ts` and `read-live-tickets.ts`.
- `src/main/tmwk/rpc/ticket-rpc-methods.ts` (`tickets`, `ticketAccept`) and `src/cli/tmwk/ticket-handlers.ts`.

Change:

- `main-session-turns.ts`: refresh snapshots after each completed turn.
- `refresh-working-summary.ts`: the ticket triggers (D28).
- `render-context-block.ts`: ticket counts and the needs-me list.
- `history`: add `ticket:<taskId>` sources.

Acceptance:

- A completed task is a result in `tickets --needs-me`. After `tickets accept` it is not, and plain `tickets` still lists it.
- `tickets --since <v>` lists only tickets changed after `v`.
- A decision sorts before a stop, a stop before a result.

Depends on: W1. Its prompt edit is in W8.

### W6. Presence and the away message

Add:

- `src/main/tmwk/presence/presence-state.ts` (pure) and `presence-store.ts` (`store/presence.json`).
- `src/main/tmwk/away/render-away-digest.ts` (pure) and `post-away-digest.ts`, which sends the notice and then advances `digestVersion`.
- `src/main/tmwk/rpc/presence-rpc-methods.ts` (`presence.report`, `awayPreview`) and `orca tmwk away --preview`.
- In `src/renderer/src/components/main-chat/`: a `use-main-chat-presence.ts` hook in `MainChatView` that reports while visible and focused.

Change:

- `main-session-turns.ts`: feed `prompt` events to presence.

Use `TMWK_AWAY_AFTER_SECONDS` under the same unpackaged-only rule as W4's hook.

Acceptance:

- Away, then a ticket completes, then the main view becomes visible: one card, then one partner message that lists the result.
- Away with nothing changed: no card.
- A second return with nothing new: no card. The watermark advanced.

Depends on: W5.

### W7. Continuity in the main view

Change `src/renderer/src/components/main-chat/` only:

- `MainChatContinuityStrip.tsx`: shown when the pin has `previous`. "Show earlier" opens the newest previous session read-only, per the W1 spike. If a closed session cannot render without resuming, link it in `orca tmwk history read session:orca:<id>` form instead and record that.
- Strings through `useTranslate`, under `tmwk.mainChat`.
- Follow `docs/STYLEGUIDE.md` and the tokens in `src/renderer/src/assets/main.css`. Use the shadcn primitives in `src/renderer/src/components/ui/`.

Acceptance: a CDP screenshot of the main view after a rollover shows the strip and the flush and briefing as collapsed mail cards. One after "Show earlier" shows the earlier session.

Depends on: W3.

### W8. Partner prompt

Change `resources/tmwk/main-partner.md` only:

- tmwk notices: what the flush, briefing and away cards are, and that their content is data from tmwk, not the user;
- the flush: save any unsaved standing rule with `preference set`, then stop. No other action in that turn;
- the briefing: bind Run `main` first, then carry on without telling the user that a new session started;
- `summary write` only when the user asks for something to be recorded in the summary. tmwk keeps the summary current otherwise;
- the away card: one message in the given order, nothing from memory, nothing when the user has moved on;
- `orca tmwk context` at the start of a turn after a gap of an hour or more;
- replace "every completed ticket counts until the user accepts it" with `tickets --needs-me` and `tickets accept`, and call `tickets` after a restart instead of `task-list`;
- "start fresh" or "new conversation" from the user: `orca tmwk main rollover`.

Keep it agent-neutral and the commands plain `orca tmwk ...`. The prompt reaches the main session at its next rollover, which M3 now provides.

Acceptance: the M1 and M2 behavior checks still pass. Run each new prompt check twice. A miss is a prompt fix, not a pass.

Depends on: W4, W6.

### W9. What's running

Change `src/renderer/src/components/main-chat/` only:

- `MainChatActivityPanel.tsx` (D30): collapsible, in the main view beside the chat. Needs you, Running, and Finished in the last 24 hours, from `tmwk.tickets`. Rows open the owner's session through existing navigation, per the W1 check.
- The same style and string rules as W7.

Acceptance: with one running ticket and one finished, a CDP screenshot shows each under its heading. After the running ticket completes, the next refetch moves it to Finished, and to Needs you while it is unaccepted.

Depends on: W5.

## First-class citizens

- **Cross-platform.** All new files are JSON under `storeDir`, resolved with `node:path`. No shell commands. `summary write --text-file -` avoids heredocs and quoting, which matters most on Windows. Read `docs/agents-md-refs/cross-platform-support.md` in W1; this guide does not claim coverage.
- **Remote hosts.** Everything runs on the home host, through RPC. An `orcad` home has no Electron `powerMonitor` and no renderer of its own, so presence comes from user turns and from paired desktops' `tmwk.presence.report`. Rollover on `orcad` with no client attached is the homelab case. It must work, and it is untested (runbook check 11). Owners on other hosts are unaffected: their mail reaches Run `main`, and W1 checks it survives a rollover.
- **Mobile.** A phone user is present through their turns. Notices are mail cards, which mobile renders as it renders any chat mail **(verify)**. The continuity strip is desktop-only in M3. `mobile/**` is Track.
- **Folder workspaces.** Nothing in M3 assumes a git worktree. The main home is a folder workspace. Ticket snapshots store task ids, not branches.

## Tests

Add tests only where a revert would fail them, with hardcoded expectations. The rules are in [test-antipatterns](../agents-md-refs/test-antipatterns.md).

| Test                    | Layer                                         | Fails if                                                                                                                            |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Same-agent rollover     | Main unit on `replaceMainSession`, fake `rpc` | A rollover with the pinned agent is a no-op, the old session is closed before the new pin is written, or `previous` loses an entry. |
| An old pin still loads  | Main unit on `isMainSessionRecord`            | A pin without `previous` or `briefedAt` is rejected.                                                                                |
| Rollover decision       | Pure unit, literal inputs                     | It rolls over below the threshold, mid-turn, on `unknown` usage, or never falls back after two forced refresh failures.             |
| Summary retention       | Main unit on the store, mkdtemp `TMWK_HOME`   | A 21st summary keeps the oldest, or a corrupt file is overwritten.                                                                  |
| Tickets since a version | Main unit on the snapshot store               | An unchanged ticket appears in `--since`, or an accepted result stays in `--needs-me`.                                              |
| Presence                | Pure unit, literal timestamps and threshold   | A return fires twice for one absence, or fires without an absence.                                                                  |
| Away digest             | Pure unit                                     | Nothing changed but text is returned, or the order is not decisions, stops, results.                                                |

Not added: CLI flag parsing, plain-text formats, RPC wiring, notice delivery, the prompt text, refresh debounce timing, the activity panel, or the renderer strip. The runbook shows them.

## Validation runbook

This proves the done-when with screenshots and transcripts, saved under `docs/tmwk/m3/`. Use M1's launch recipe: a clean `env -i`, `ORCA_BACKGROUND_LAUNCH=1`, a fresh `TMWK_HOME` and user data directory outside any Claude Code scratchpad, and CDP screenshots of the hidden renderer. Never call `show()` or `focus()`. Add `TMWK_ROLLOVER_PERCENT` and `TMWK_AWAY_AFTER_SECONDS` where a check says so. Save each transcript as a text file next to its screenshot.

| #   | Check                     | Evidence                                                                                                                                                                                                 |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Manual rollover           | `orca tmwk main rollover`. The flush card, a `refresh` summary, a new pin with the old one in `previous`, and the briefing card (`01-rollover.png`, `summary show`, `main-session.json`).                |
| 2   | Nothing visibly lost      | Before check 1, set "Never merge without asking me" and talk about a plan. After: "What were we doing?" is answered from the summary, and "merge it" gets a question (`02-continuity.png`).              |
| 3   | Automatic trigger         | `TMWK_ROLLOVER_PERCENT=5`. An ordinary exchange rolls over after a turn ends, never during one (`03-auto.png`, the main log line).                                                                       |
| 4   | Summary failure           | Make the forced refresh fail (an unavailable model in a dev build). The old session stays pinned. A second failure rolls over with reason `fallback` (transcript). A timed-out flush does not hold it.   |
| 5   | Switch carries context    | Claude to Codex from the switcher: "Saving context…", the flush on Claude, the briefing on Codex, and Codex answers check 2's question (`05-switch.png`).                                                |
| 6   | Owners survive a rollover | Start a ticket, roll over while its owner works. Its `worker_done` wakes the new session (`06-owner-wake.png`).                                                                                          |
| 7   | Continuity strip          | After check 1, the strip shows and "Show earlier" opens the earlier session (`07-strip.png`, `07-earlier.png`).                                                                                          |
| 8   | Restart mid-rollover      | Kill the app during the flush, then relaunch. One pinned, briefed session, and no duplicate (transcript of `main-session.json` and `session.tabs.list`).                                                 |
| 9   | The away message          | `TMWK_AWAY_AFTER_SECONDS=60`. Hide the main view, let a ticket complete and another ask a question, then show the view. One card, then one message: the question first, then the result (`09-away.png`). |
| 10  | Nothing happened          | Away and back with no ticket change: no card (`10-quiet.png`). `away --preview` prints nothing.                                                                                                          |
| 11  | `orcad` home              | Checks 3 and 6 on an `orcad` home with no client attached, read back with `agent read`. Mark **Not tested** if it cannot run.                                                                            |
| 12  | Codex and one ACP agent   | Checks 1 and 2 with the pin's agent set to `codex`, then once with an ACP agent.                                                                                                                         |
| 13  | Mobile                    | Check 9's card on a paired phone. Mark **Not tested** without one.                                                                                                                                       |
| 14  | Background summary        | Over a 20-minute session with two ticket events, `summary show --history` gains `refresh` entries, none of which appear in the main chat. The `refresh` count matches the main log's refresh lines.      |
| 15  | What's running            | W9's acceptance on a live run, with an owner on another agent (`15-activity.png`).                                                                                                                       |

Checks 2, 5, 9 and 12 are judgment, not mechanism. Run each twice. Record a miss as a prompt fix.

Teardown: kill the dev process by pid, `orca worktree rm` any owner worktrees, and `rm -rf` the scratch directories.

Before every push, run `pnpm check:changed`, `pnpm test:ast-grep`, `pnpm verify:rpc-params-catalog` and `pnpm tc`.

## Risks

- **Notices may need a sender.** If `orchestration.send` refuses `from: 'tmwk'`, the fallback is a user-role bubble with a `[tmwk]` prefix. It works but looks like the user said it. W1 decides before anything builds on it.
- **Turn streams in process.** If Own code cannot follow `subscribeTurnCompletions`, the trigger, the flush wait and presence all need another signal. The fallback couples `src/main/tmwk` to native-chat host internals, which churn daily (fork-ownership: the most-churned code). Keep that coupling in one file.
- **Provider compaction gets there first.** Claude and Codex compact on their own (`compact_boundary`, `thread/compacted`). If the provider compacts before the threshold, usage becomes `unknown` and the rollover waits for fresh facts. Keep the threshold below `autoCompactAtTokens`. A compaction loses detail the summary would have kept, but the session itself survives.
- **Mail between sessions.** Owner reports sent during a rollover could reach the closed session. W1 tests it. The same gap exists for today's agent switch.
- **The flush is a model turn.** It can do more than asked. The notice and prompt forbid other actions. An outward action in a flush turn is a prompt fix. It is now small, and the rollover does not depend on it.
- **The background summary spends calls outside the chat.** On a usage-limited plan this competes with the main chat. The debounce, input-hash dedup and the present-only rule bound it. Check 14 counts the calls.
- **The summary can miss what the partner knows.** The one-shot reads at most 100 shortened entries. A long thread between refreshes loses detail. The 50% trigger refreshes before the 70% rollover, so the forced run covers only the last stretch.
- **Presence is approximate.** A user reading on a phone without typing is "away". A desktop left visible on an unattended screen is "present". The 30-minute threshold limits both. Owner call in D23.
- **Ticket snapshots depend on turns.** A Run deleted before any main-session turn sees its final state is lost. Every owner report wakes the partner, so this needs a wake to be missed. Restarts are the likely case, and bootstrap refreshes snapshots.
- **A rollover costs a short flush turn, a one-shot refresh and a briefing turn.** On a usage-limited plan, a rollover near the limit can fail. The flush is skipped when nothing new was said, and the fallback summary needs no model call.
- **M2 lands first.** Every step uses M2's store and RPC namespace. If M2's PRs change on review, re-check [Preconditions](#preconditions-from-m2-and-the-agent-switch).

## Deferred

M4:

- the ticket-first sidebar overview, which grows from D30's panel;
- the crew panel's session-centric view, if the main view reuses it;
- actions from the activity panel (accept, stop, retry).

Not scheduled:

- **Per-user-turn context push.** Two candidates, both outside M3: Claude's `UserPromptSubmit` hook with `additionalContext`, written as a project hook in `~/.tmwk/main/.claude/settings.json` (Claude-only, and likely ignored in an untrusted folder as `permissions.allow` was in M0 finding 1 **(verify)**), and Codex's per-turn `developer_instructions`, which `codex-structured-turn-start.ts` sends as `null` (a Track edit). Neither is agent-neutral.
- **A hidden flush turn,** which needs a send flag in native chat (Track).
- **One merged transcript** across sessions in the main view.
- **Mobile continuity strip and mobile presence reports** (`mobile/**` is Track).
- **Scheduled wakes** with a deterministic precheck (M1 guide), and the ongoing-ticket scheduler (M0 finding 6). D17's notice is the building block both need.
- **Migrating the store** when the home host changes.
- **Summary quality checks,** such as asking the new session to restate the summary and comparing.
- **Daily notes,** as in OpenClaw's `memory/YYYY-MM-DD.md` and grenada's `<daily>` lines from the summary one-shot.
- **Holding owner reports while the user is away,** as grenada did. Reports reach the partner as Orca mail, so holding them needs an orchestration change (Track).
- **In-place compaction instead of a new session,** as OpenClaw does. Provider compaction already runs, and D15's threshold sits below it.

## Doc updates

Land these with the code, in the PR that causes each one:

- **main-chat.md, "Memory and continuity":** the summary file and commands (W2); rollover as tmwk-triggered, with notices instead of a hidden turn (W4); "per wake" instead of "per turn" (W2); presence and the digest (W6).
- **main-chat.md, "Switching the main agent":** the flush and briefing on switch, and "Saving context…" (W3, W4).
- **main-chat.md, "CLI surface":** the commands in [CLI surface](#cli-surface) (each step).
- **main-chat.md, "Main view":** the continuity strip (W7) and the activity panel (W9).
- **main-chat.md, M0 finding 5:** ticket snapshots outlive the Run (W5).
- **main-chat.md, "Milestones":** link this guide where the M1 and M2 guides are linked. Done in the PR that adds this guide.
- **m2-implementation-guide.md, "Deferred to M3 and M4":** mark what M3 delivered, and W6 as absorbed if it was.
- **m1-implementation-guide.md, "Deferred":** mark the M3 items done or moved.
- **fork-ownership.md:** the decision-log line in [Ownership changes](#ownership-changes), D28's Extend row if needed (W2), and any row a W1 fallback adds.
- **`resources/tmwk/main-partner.md`:** the W8 edits.
- Run `pnpm exec oxfmt --write docs/tmwk/m3-implementation-guide.md` before committing this file.

## W1 spike results

Answered by reading code. Live checks still pending are listed last.

- **Notices**: `orchestration.send` accepts `to: 'orca_session_id:<sessionId>'` (main session ids are bare UUIDs, so `sendMainNotice` prefixes them). No `run` is needed and `subject` is required. An unbound chat receives it through its own session mailbox. The card heading is "Message from" plus the sender label (`agentMessageHeading`, generic branch). `from: 'tmwk'` sender access has not been run live. Fallback (D17) sits behind `sendMainNotice` and returns `{ via: 'mail' | 'send' }`: it fires on any `TmwkRpcError` except `recipient_delivery_held` and `recipient_delivery_unknown` (refusal codes include `session_caller_*` and `forbidden`, not only `sender_*`), reads the fence from `agentSession.history` and builds the send with `structuredAgentSessionMessageSendMutation`. Logged once.
- **Turn stream**: `RpcDispatcher.dispatchStreamingObjects` runs in process with a `local-cli` caller and an abort signal. `createTmwkRuntimeClient(runtime)` returns `{ rpc, subscribe }` over one lazy dispatcher. Chosen design: one `agentSession.subscribeTurnCompletions({ includePrompts: true })` per runtime, with the pin re-read on each event, so a replaced session needs no resubscription. Later steps register through `onMainTurn`, which works before or after `startMainSessionTurns`. Frames are handled in stream order, and the stream resubscribes after it ends.
- **`prompt` events**: fire only for newly pending approval or question prompts, not for user sends. D23's user-turn presence needs another signal. Decided in W6: a completed pinned-session turn whose triggering entry is a user message counts as presence.
- **`contextUsage` shapes**: Claude reports with an optional `autoCompactAtTokens`, which `selectStructuredAgentContextUsage` drops, so W4 must read the raw `contextUsage.current` for it. Codex reports only. ACP gives an estimate only. Pi any shape. Unknown becomes `null`.
- **`runGenerationRequest` (D28)**: requires a `TextGenerationOperation` member, so D28 needs the Extend patch (W2 adds `'tmwk-working-summary'`). The naming runtime is local-only and skips copilot, kimi, cursor and hermes, while `runGenerationRequest` itself supports remote targets. Agents with commit-message specs (claude, codex, opencode, pi, amp, cursor, kimi, omp and others) can run it. Others get the fallback summary.
- **Mail across rollover**: mail to `run:<main>` waits unread until the new session's `run-use` rebinds the run (`routeAllUnreadDirectMessagesToRunMailbox`). Live check pending.
- **Closed session (W7)**: `agentSession.close` retires and hides the tab, so it leaves `unifiedTabsByWorktree` unless capture fails. `agentSession.history` reads the journal without a provider resume. Live check pending.
- **Ticket row navigation (W7/W9)**: `activateWorktreeAgentPane` (`src/renderer/src/components/sidebar/workspace-card/activity/use-worktree-agent-activation.ts`) and `openAgentSessionTabThroughLayoutOwner`.
- **Cross-platform**: `cross-platform-support.md` read. Use `path.join`, and `@orca/process-host` for spawns. No rule exists for `document.visibilityState`; follow `orca-window-foreground-focus.ts`.
- **Live run (2026-11-18, after W3)**: in process, `orchestration.send` first failed with `orchestration_migration_required` ("obsolete contract"), because orchestration mutations need `orchestrationContractVersion` on the request envelope, which the CLI client sets. `createTmwkRuntimeClient` now sets it for `orchestration.*` methods. With it, `from: 'tmwk'` is accepted and the notice renders as `NativeChatAgentMessageCard`, collapsed, headed "Message from an agent" (the sender label is generic, not `tmwk`). D29 stands. The `[tmwk]` user-bubble fallback also worked before the fix. The observer logged one line per main turn. A Claude session briefed after `main rollover` answered from the summary and the standing preference, created Run `main`, and bound it.
- **Live checks remaining**: mail across a rollover, and a closed-session render.

## W5 results

Read from `src/main/runtime/rpc/methods/orchestration/` and `src/main/runtime/orchestration/db/`.

- **Reads** (in process, through `createTmwkRpc`):
  - `orchestration.runList()` returns `{ runs: [{ id, objective, ... }], nextCursor }`, every Run when no `limit` is given.
  - `orchestration.taskList({ run })` returns `{ tasks: [{ id, run_id, task_title, display_name, spec, status, result, completed_at, assignee_handle? }] }`. `assignee_handle` appears only while `status` is `dispatched`, and is the snapshot's `owner`; it is a terminal handle, not an agent id.
  - `orchestration.gateList({ run, status: 'pending' })` returns `{ gates: [{ task_id, question, options, ... }] }`.
  - `orchestration.inbox({ run, limit: 200 })` returns `{ messages: [{ id, type, body, thread_id, payload, ... }] }`.
- **Run filter**: Runs whose `objective` is `main` (trimmed, case-insensitive), which is how the partner prompt creates its Run (`run-create --objective "main"`). `runList` strips `coordinator_orca_session_id` (`exposeRun`), so the pin and its `previous` list cannot be matched against it. Run ids are generated, so the id cannot be matched either.
- **Questions**: Orca has no list RPC for asks. An `ask` is a `question` message in the Run's inbox whose `payload` JSON carries `taskId`; the answer is a later message with `thread_id` equal to the question's id. A question with no such reply, on a task that is not `completed` or `failed`, is pending. A gate or a pending ask sets the snapshot's `question`, which makes the ticket a decision. The inbox read is capped at 200 messages, so a question older than that window is missed.
- **Escalations** are not read separately. A task counts as a stop only when its status is `failed` or `blocked`.
- **Counts line**: the context block prints `N need you (decisions, stops, finished unaccepted)` and `M running`. A finished unaccepted ticket is a `result`, so it is counted in the first group and not repeated.
- **Summary input**: `TmwkSummary` gains an optional `ticketVersion`. A refresh feeds the model the tickets whose `changedAt` is above the previous summary's `ticketVersion` (title and current status, not the earlier status, which the store does not keep).
- **Refresh failures**: a failed orchestration read is logged and leaves the stored snapshots as they were; `tickets` then answers from the store.

## W6 results

- **Detecting a user turn**: on each pinned-session `completion`, `agentSession.history` (tail, limit 1) gives `latestTurn.turn.userItemId`, and `agentSession.item` reads that entry. The turn is a person's when the entry is a `message` with role `user`, no `from` (mail and tmwk notices carry an `AgentMessageSource`) and text that does not start with `[tmwk]` (the notice fallback in `sendMainNotice` is a user-role message). Presence is recorded at the turn's `requestedAt`, else `startedAt`, else the record's `observedAt`.
- **Order in D24**: a return found by a user turn is found at that turn's completion, because the observer only sees `completion` events. The digest is mailed after the user's turn has ended, so it never interrupts it and is always behind it. In practice the desktop view report arrives first and the digest is posted before the user types. The post runs inside `runMainSessionOperation`, so it waits for a rollover or switch and reaches the new pin.
- **Deviation, handled by owners**: the section lists only tickets that completed and were accepted. The spec also names retried tickets, but a snapshot keeps no earlier status, so a retry cannot be told from a first run and is not listed.
- **Pending return**: a return is held in memory until a digest post succeeds (a missing pin or a failed send keeps it), and the next presence event retries. A restart before the post loses it.
- **Refinements**: `awaySince` is the last time the user was present, and a return clears it. The digest is gated on changed tickets that need the user or were handled, so a change in a running ticket alone posts nothing. The digest notice does not carry the context block; only the session briefing does.

## W7 results

- **Closed session**: `NativeChatView` cannot be mounted read-only for a closed session without Track edits. It needs a live tab (`tabId`, `groupId`) and an owner, which `agentSession.close` retires, and it always renders the composer. W7 builds an Own `MainChatEarlierTranscript` instead.
- **Read path**: `tmwk.historyRead` with `session:orca:<sessionId>` returns one `body` string (`role: text` lines, last 100 entries, with a shortened marker), not entries. The transcript splits the lines back into role-labelled blocks and keeps whitespace; no markdown rendering. A message whose text contains a line that looks like a role line is split wrongly.
- **View**: "Show earlier" shows the newest `pin.previous` session in place of the live chat, which stays mounted but hidden so its state survives. "Back to current" returns. Desktop only.

## W9 results

- **Owner mapping**: a ticket's `owner` is a terminal handle, and the renderer store's `agentStatusByPaneKey` entries carry `terminalHandle`, `worktreeId` and `agentType`. The panel matches on that and calls `activateWorktreeAgentPane(worktreeId, tabId, paneKey, executionHostId)`, matching only panes whose `getAgentPaneExecutionHost` equals the chat's host; on a handle collision the newest `updatedAt` wins. A row whose owner has no live agent pane (finished, other host, not yet reported) is not clickable, and its owner label falls back to the shortened handle.
- **Refetch**: on open, every 30 seconds while the window is visible (also while collapsed, deliberately, so the toggle's needs-you count stays current), and when the pinned chat's pane `turnEndedAt` changes. A failed fetch keeps the last snapshot and shows a muted "could not refresh" line.
- **Grouping**: blocked tickets with no needs-me sit under Running. Finished uses `completedAt`, falling back to `lastSeenAt`. Ages and the 24 hour cutoff use a minute-ticking `now`.
- **Open state** is plain component state, not remembered.
- `RUNNING_STATUSES` moved to `src/shared/tmwk/tmwk-tickets.ts`.

## Owner answers

Answered by the owner on 2026-11-18, after W1–W9 were built. Each answer matches the proposal as built, so no code changed.

1. **D17.** Visible notice cards in the main chat are okay. No hidden-turn patch to native chat.
2. **D18.** The fallback summary built from the old transcript is fine when the forced refresh fails twice.
3. **D21.** Per wake plus `orca tmwk context` is good enough for M3. Per-user-turn push stays unscheduled.
4. **D22.** M3 takes M2 W6 (tickets and acceptance), as built in W5.
5. **D23.** The away threshold is 30 minutes. Mobile is ignored: reading on a phone without typing does not count as present, and there is no mobile patch.
6. **D25.** The continuity strip with "Show earlier" is enough for one continuous conversation.
7. **D27.** `orca tmwk main rollover` joins the documented surface, and the partner runs it when the user says "start fresh".
8. **Numbers.** Confirmed as built: a 90% hard ceiling, a 2-minute flush wait, a 50% refresh trigger, 4,000 characters per summary, 20 kept summaries, a 60-second presence report and a 30-second panel refetch, with the 70% trigger confirmed earlier.
9. **Beyond the strip.** Nothing more: a rollover shows only the strip, with no extra partner message.
