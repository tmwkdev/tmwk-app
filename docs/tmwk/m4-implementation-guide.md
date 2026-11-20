# M4 implementation guide: the ticket-first overview

This guide turns the M4 row of [main-chat.md](main-chat.md#milestones) into build steps: "The sidebar is organized by ticket, with sessions beneath, as described in VISION." The design is the [M4 design spike](m4-design-spike/README.md), merged in PR #36: [Finalist 1 · Attention list](m4-design-spike/directions/f1-attention-list.md), the [conversation-and-rail ticket view](m4-design-spike/directions/ticket-view.md) (T4), [New ticket](m4-design-spike/directions/r3-new-ticket.md), and [Ticket options with custom status order](m4-design-spike/directions/r3-ticket-options.md). The owner approved it on 2026-11-19 with one change from the spike's alternatives: **Chat stays in the bottom dock** (PR #34), not on top.

It was written on 2026-11-19 from a read of `main` at `8436bbf2af` (M3, O0, O1, the brand plan through D55, the compact Chat dock and the spike). Every code reference was found by reading the code. Items marked **(verify)** were not run and must be checked in the step that names them.

**Done when:**

- the sidebar lists tickets under **Tickets** (Needs you, Quiet, Done), each needs-you row with its reason as the second line, sessions one disclosure beneath their ticket, hosts only when they explain something, and projects as a filter;
- opening a ticket shows its conversation with a rail of Sessions, Code and Where, and a pending decision answers in one click;
- the sidebar's + opens New ticket, whose request lands in Chat as an event the partner briefs and delegates, or asks about first;
- Ticket options replace Workspace options, with custom status order and the pinned Needs you strip;
- folder workspaces and raw worktrees stay one click away.

## Preconditions

| Interface                                                                         | File                                                                                                         | What M4 does with it                                                                                                 | Re-check                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `TmwkTicket` snapshot, `isTmwkTicket`, `RUNNING_STATUSES`                         | `src/shared/tmwk/tmwk-tickets.ts`                                                                            | Becomes an attempt observation under a tmwk ticket record (W1, after O2).                                            | Fields `taskId, runId, title, status, result, question, owner, needsMe, acceptedAt, changedAt`. |
| `readLiveTickets(rpc)`, the snapshot store, `refreshTicketSnapshots(runtime)`     | `src/main/tmwk/tickets/`                                                                                     | W1 keeps the reads and attaches them to tickets. Refresh still runs after each main turn and on each `tickets` call. | Reads Runs whose objective is `main` only; `inbox` limit 2000.                                  |
| `classifyNeedsMe`, `orderTickets`                                                 | `src/main/tmwk/tickets/needs-me-order.ts`                                                                    | The attention order everywhere: decision, stop, result.                                                              | Pure.                                                                                           |
| `tmwk.tickets`, `tmwk.ticketAccept`                                               | `src/main/tmwk/rpc/ticket-rpc-methods.ts`, `src/shared/rpc-contract/tmwk/tmwk-rpc-params.ts`                 | Kept for the CLI. The renderer moves to `tmwk.ticketOverview` (W2).                                                  | Both call `requireTmwkHomeHost()`.                                                              |
| `sendMainNotice(rpc, sessionId, { subject, body })`                               | `src/main/tmwk/notices/send-main-notice.ts`                                                                  | Gains an optional `payload`, so the request and system lines can render as events (W6).                              | `from: 'tmwk'`, `type: 'status'`, the `[tmwk]` fallback.                                        |
| `useMainChatSession()`, `useMainChatTickets(target, tabId)`, `MainChatView`       | `src/renderer/src/components/main-chat/`                                                                     | The home-host target and refetch pattern for the overview hook (W2). `MainChatView` hosts the ticket view (W4).      | 30-second visible-window refetch plus the pinned tab's `turnEndedAt`.                           |
| `MainChatActivityPanel` (M3 D30)                                                  | `src/renderer/src/components/main-chat/MainChatActivityPanel.tsx`                                            | Removed in W3: the sidebar list replaces it.                                                                         | Owner-pane matching through `agentStatusByPaneKey[].terminalHandle`.                            |
| `WorktreeList`, `SidebarHeader`, `sidebar-header-actions.tsx`, `SidebarToolbar`   | `src/renderer/src/components/sidebar/`                                                                       | The mount points (Extend, already listed in the map).                                                                | `WorktreeList.tsx` and `chrome/**` are Extend; `sidebar/index.tsx` is Track.                    |
| `activateWorktreeFromSidebar`, `activateWorktreeAgentPane`                        | `src/renderer/src/lib/workspace/activation/`, `src/renderer/src/components/sidebar/workspace-card/activity/` | Session rows and "Watch all" open Orca's own views.                                                                  | Signatures as read.                                                                             |
| `ProjectCombobox`, `RunTargetCombobox`, `AgentLaunchPicker`, `ButtonKeyHint`      | `src/renderer/src/components/new-workspace/**`, `src/renderer/src/components/agent/`                         | The New ticket sheet reuses them (W6).                                                                               | Exported and prop-driven, not tied to `useComposerState`.                                       |
| `FilterToggleRow`, `DropdownMenu*`, `ToggleGroup`, `StatusIndicator`, `AgentIcon` | `src/renderer/src/components/sidebar/**`, `src/renderer/src/components/ui/`                                  | Ticket options and the rows (W3, W7).                                                                                | As the spike rendered them.                                                                     |
| The fixture harness                                                               | `src/renderer/src/component-fixtures/`, `pnpm fixtures:shot`                                                 | Every sidebar state gets a fixture, compared with the spike images.                                                  | Fixtures are discovered by `*.fixture.tsx` glob.                                                |

## What changes from main-chat.md and the plans

Fold these into main-chat.md in the PR that causes each one (see [Doc updates](#doc-updates)).

1. **Tickets are tmwk records first (O2 inside M4).** The ownership plan's O2 is the first M4 step. See D56.
2. **The sidebar replaces the activity panel.** M3's D30 panel was a stand-in for the overview. W3 removes it.
3. **Two ways to start work produce the same event.** The sheet and a Chat message both reach the partner, which briefs and delegates. The sheet's request is a ticket the moment it is submitted (D58).
4. **Answers and owner messages go straight to the ticket**, and join its history. The partner is not a relay for them (D60).
5. **Projects become a filter.** The worktree list stays, one click away, as the Worktree view (D62).

## Decisions

Numbering continues after the brand plan's D55. **Owner call** marks a recommendation that changes a documented surface or a Track path.

| #   | Decision                                                | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Owner call                                        |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| D56 | O2 first, or M3's snapshots.                            | **O2 first, as W1.** M3 snapshots carry no host, agent, worktree, branch, or owner session once a task leaves `dispatched` (Orca strips `assignee_handle` and `dispatch_id` from `taskList`), and a snapshot cannot exist before its Orca Task. New ticket needs exactly that: a ticket that exists while the partner briefs it, or while it waits on a clarifying question. Building on snapshots means a parallel "request" record and a fleet join that O2 then replaces. O2 is designed, the owner chose it as the next step (ownership plan, answer 6), and nobody has started it. W1 builds O2 as specified, plus three fields M4 needs: a `requested` status before any attempt, an optional `kind: 'ongoing'`, and per-attempt `dispatchId`, `agent`, `host` and `worktreeId`. | Decided 2026-11-19: "M4 building O2 makes sense." |
| D57 | The overview's read model.                              | One RPC, `tmwk.ticketOverview`, on the home host. It refreshes like `tickets`, then joins each ticket's open attempts to `orchestration.workerList` (the fleet page: provider, host, workspace, stage, liveness, `parent.taskId`) for sessions, last activity and host, and returns finished row models: `{ id, title, project, state, reason, kind, sessions, host, lastActivityAt, pr?, attention }`. The renderer only filters, groups and draws. Pure derivation lives in `src/shared/tmwk/ticket-overview/` so the CLI (`tickets`) and the sidebar agree. A failed fleet read keeps the record's last values.                                                                                                                                                                     | No.                                               |
| D58 | What New ticket submits.                                | `tmwk.ticketRequest({ words, projectId?, runOn: 'auto' \| hostId, agent?, source? })` creates a ticket with status `requested`, then posts a notice to the main session whose payload is the request event. The partner, woken by the notice, briefs and runs `orca tmwk ticket start --ticket <id>` (O2's command, given an existing requested ticket), or asks one question with `orca tmwk ticket ask <id> --question … [--recommend …]`. The question makes the ticket a decision in Needs you, answered from the sidebar, the ticket view or Chat. The title is drafted by the partner (`ticket start --title`); until then the row shows the first line of the words.                                                                                                            | No.                                               |
| D59 | How the request looks in Chat.                          | As an event, not a message. Notices already render as Orca's agent-message card, never as a user bubble. W6 adds the spike's event card and system lines ("Brief ready", "Delegated to … on mbp", "Couldn't start …") through **one Extend patch** in native chat: where `NativeChatAgentMessageCard` renders a `from: 'tmwk'` mail notice whose payload names a tmwk event kind, it renders the Own `TmwkChatEvent` instead. The system lines are posted by tmwk itself when the attempt is attached or fails, so "Delegated" is confirmed state, not the partner's claim. If the patch conflicts on a sync, drop it: notices fall back to today's card, which still reads as an event.                                                                                               | Yes: an Extend in native chat.                    |
| D60 | "Message the owner" versus talking through the partner. | Both, as VISION says. The ticket view's composer and the decision card's answers go **straight to the ticket** through `tmwk.ticketMessage` and `tmwk.ticketAnswer`, which record the message or answer in the ticket's history, then deliver it: an answer resolves the gate (`orchestration.gateResolve`) or replies to the question (`orchestration.reply`); a message is `orchestration.send` to the open attempt's owner. The partner reads the history through its context block and `tickets`; it is not woken for each one. In Chat, "tell the settings owner to …" still works through the partner. One record, two doors.                                                                                                                                                    | No.                                               |
| D61 | Failed delivery and failed delegation.                  | A failed answer or message stays in the ticket thread with "Not delivered · Retry · Send through Chat"; the decision stays pending. A failed delegation is O2's `failed_start` attempt: the ticket becomes a stop ("Couldn't start: <failedStage reason>") in Needs you, Chat gets a "Couldn't start" system line, and the ticket view offers Retry, which asks the partner (`ticket retry`). An unreachable home host keeps the last overview and says "Can't reach <host> · last update <time>" above the list; open questions stay listed.                                                                                                                                                                                                                                          | No.                                               |
| D62 | Where folder workspaces and raw worktrees live.         | **The Worktree view**: today's `WorktreeList`, unchanged, with Workspace options, project groups, folder workspaces, PR grouping and project order. It is a sidebar mode, not a route. "Worktree view" ends Ticket options and a "Tickets" link heads the worktree list; the mode is remembered. Search still finds worktrees in either mode, a ticket's Code section opens its worktree, and the existing project filter (`filterRepoIds`) is shared by both modes.                                                                                                                                                                                                                                                                                                                   | No.                                               |
| D63 | Filtered-empty.                                         | "No tickets match these filters · Clear filters" in place of the sections. The pinned Needs you strip still shows the needs-you count across filters, scoped "in tmwk-app" when a project filter excludes some, and a project filter with no tickets says "No tickets in tmwk-app · All projects". The options button carries Orca's active-filter badge.                                                                                                                                                                                                                                                                                                                                                                                                                              | No.                                               |
| D64 | Scrolling, keyboard and selection.                      | Not virtualized: the list is short (tens of rows) and grouped. One scroll container with the pinned strip `sticky` at the top. A `listbox` with roving focus: ↑↓ move, → opens the sessions, ← closes them or moves to the parent ticket, Enter opens the ticket, Space toggles Done. Selection is the open ticket's id, so re-sorting never moves it; when the list reorders, the selected row keeps its screen offset (measured before, restored after layout). Full titles and reasons are reachable by focus and by opening, never by hover alone.                                                                                                                                                                                                                                 | No.                                               |
| D65 | Where the ticket view lives.                            | Inside the `'main'` view: `MainChatView` shows Chat or one ticket, keyed by an Own `openTicketId`. The Chat dock returns to Chat. No new `TopLevelView` member, so no new Extend in `ui-chrome`. The rail folds into a "Details" disclosure under 900 px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No.                                               |
| D66 | Ticket options storage.                                 | Group by, sort within group, row density, Show on rows, the three filters and the status order are per user, in an Own renderer store persisted to `localStorage` (`tmwk.ticketOptions.v1`), read with try/catch and defaults. They are view preferences, not work state. The project filter stays Orca's `filterRepoIds` (D62).                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No.                                               |
| D67 | Ongoing, Waiting and Paused without new Orca state.     | `kind: 'ongoing'` is set by `ticket start --ongoing`; it draws the repeat mark in any status. Waiting is `requested` (the partner is briefing) and an ongoing ticket with no running attempt. Paused is an attempt whose host is unreachable, or a dispatch Orca reports suspended. There is no Pause button: Orca has no pause primitive for a dispatch. The header offers Accept (results), Stop (open attempt), Open in Chat and Copy ID.                                                                                                                                                                                                                                                                                                                                           | No.                                               |

**Changed by the W1 spikes** ([W1 results](#w1-results)):

- **D60, delivery.** `tmwk.ticketAnswer` cannot resolve a gate or reply to a question in process: both need Run `main`'s coordinator, and the in-process caller is none. W5 records the answer in the ticket's history, then delivers it with request-level evidence naming the pinned partner session (`agentSessionId`), so Orca accepts it as the coordinator's. W5 verifies that live; if it is refused, the fallback is a notice to the partner carrying the answer, which runs `reply` or `gate-resolve` itself, and the thread shows "Sent through Chat". `tmwk.ticketMessage` uses `orchestration.send`, which works in process as is.
- **D57, the fleet join.** A paired-server dispatch's `workerList` row has no `projection` (no provider, workspace, stage, liveness or `parent.taskId`), so the overview joins by `dispatchId`, not `parent.taskId`, and for a remote attempt takes host and agent from the attempt record W1 writes and last activity from `server.asOf`.
- **D67, Paused.** `workerList` never says a paired server is unreachable. The overview calls `orchestration.workerShow` for each open attempt with a `host`, at most once per refresh, and reads `server.reachable`; an SSH execution host's `liveness.reason: 'host_unavailable'` counts too.

### How each status maps

| Status (Group by Status) | Attention section | From                                                              | Glyph                        |
| ------------------------ | ----------------- | ----------------------------------------------------------------- | ---------------------------- |
| Needs decision           | Needs you         | an open gate or question on the ticket, or a pending `ticket ask` | `StatusIndicator` permission |
| Blocked                  | Needs you         | latest attempt `failed`, `blocked` or `failed_start`              | red `OctagonAlert`           |
| Ready for review         | Needs you         | latest attempt `completed`, not accepted                          | emerald `CircleCheck`        |
| Running                  | Quiet             | an open attempt                                                   | working                      |
| Waiting                  | Quiet             | `requested`, or ongoing between attempts                          | monitoring                   |
| Paused                   | Quiet             | open attempt on an unreachable host, or suspended                 | interrupted                  |
| Done                     | Done              | accepted                                                          | muted `Check`                |

A ticket in Needs you whose host is unreachable keeps its needs-you state and adds "<Host> unreachable · last report HH:MM" (an unreachable host never hides a question).

## Build order

W1 and W2 run in parallel. W3 follows both. W4, W6 and W7 follow W3; W5 follows W4. W8 is last. Each step is one PR against `main` on `origin`, stacked where it depends on another.

### W1. Tickets become tmwk records (O2)

Build [O2](orchestration-ownership-plan.md#o2-tmwk-tickets-are-primary) as written, plus D56's fields.

Add:

- `src/main/tmwk/tickets/ticket-store.ts`: `store/tickets.json` version 2: `{ id, title, words, goal?, projectId?, status: 'requested' | 'active' | 'accepted', kind?: 'ongoing', runOn?, agent?, attempts: [{ runId, taskId, dispatchId?, agent?, host?, worktreeId?, startedAt, settledAt?, outcome? }], question?, history: [...], acceptedAt?, createdAt, changedAt }`. M2's write rules. A one-time migration turns each v1 snapshot into a ticket with one attempt; the guard still reads v1.
- `tmwk.ticketCreate`, `tmwk.ticketAttach`, `tmwk.ticketShow`, `tmwk.ticketAsk` RPCs, params in `src/shared/rpc-contract/tmwk/`.
- `src/cli/tmwk/ticket-start-handler.ts`: `orca tmwk ticket start [--ticket <id>] --goal … --words … --project … --agent … [--host <id>] [--title …] [--ongoing]`, composed in the CLI process (G6), and `ticket retry <id>`, `ticket ask <id> --question … [--recommend …]`.

Change: `refresh-ticket-snapshots.ts` refreshes open attempts; unattached Tasks are still snapshotted. `resources/tmwk/main-partner.md`: create and start with one `ticket start`.

Spikes, recorded under [W1 results](#w1-results):

- Does `workerStart`'s receipt carry the dispatch id, host and worktree id (attach needs them)?
- Can an in-process `tmwk` caller run `orchestration.gateResolve` and `orchestration.reply` on Run `main` (`coordinatedRunAccess`) (D60)? If not, the RPC composes them in the CLI process path or posts an answer notice to the partner, and this guide records which.
- What does `orchestration.workerList` return for a dispatch on a paired remote host, and for an unreachable one?

Acceptance: O2's three acceptance checks, plus a `requested` ticket listed before any attempt, and `ticket ask` turning it into a decision.

Built: see [W1 results](#w1-results) for the record, RPCs and CLI as built.

### W2. The row model and the Attention list components

Built against fixtures, so it runs beside W1.

Add `src/shared/tmwk/ticket-overview/` (pure): `TicketRowModel`, `attentionSections`, `statusOf`, `titleCollisions`, `groupTickets(rows, options)` for every Group by, and `needsYouSummary`. Add, under `src/renderer/src/components/main-chat/tickets/` (Own): `TicketsSidebar` (header with title, project filter chip and +), `AttentionRow`, `QuietRow`, `SessionRows` (disclosure), `DoneRow`, `TicketsEmpty` ("Hand off work in Chat"), "Nothing needs you", the unreachable-host line, keyboard and selection (D64), and fixtures for typical, ticket selected, busy, nothing needs you, host unreachable and empty. Lift the spike's markup (`m4-finalists.tsx`, `m4-kit.tsx`) and replace its seeded data with `TicketRowModel`.

Acceptance: the fixtures match the spike's `f1-states-a` and `f1-states-b`.

### W3. The overview RPC and the sidebar mount

Add `tmwk.ticketOverview` (D57), which builds `TicketRowModel`s from W1's records and the fleet join, and `use-ticket-overview.ts`, replacing `useMainChatTickets` with the same refetch triggers plus a refetch after each `tmwk.ticket*` mutation.

Extend (logged): `WorktreeList.tsx` renders the Own `TicketsSidebar` unless the Worktree view is on (D62); `SidebarHeader.tsx` and `sidebar-header-actions.tsx` hide Orca's Projects header and buttons in Tickets mode. Remove `MainChatActivityPanel` from `MainChatView`.

Acceptance: `orca tmwk tickets --json` and the overview agree on order; in the dev app a real ticket appears, its sessions disclose and open their panes, and the Worktree view round-trips.

### W4. The ticket view

Add `TicketView` (header: title, state, project, started; Accept, Stop and a menu), `TicketThread` (history events from the record: request, brief, attempts, reports, questions and answers, messages; earlier events collapsed under "Instructions and N earlier events"), `DecisionCard`, `TicketRail` (Sessions with model, Watch all, Code with branch and PR, Where with host, why and last report) and the "Message the owner" composer, shown inside `MainChatView` by `openTicketId` (D65). "Watch all" activates the owner's worktree, where Orca shows every pane.

Acceptance: matches `f1-ticket-open`; the rail folds under 900 px.

### W5. Answers and owner messages

Add `tmwk.ticketAnswer` and `tmwk.ticketMessage` (D60), wire the decision card's buttons and the composer, and show delivered and failed states (D61). Answers from the sidebar row's decision go through the same RPC.

Acceptance: a gate answered from the card resolves in Orca and the owner continues; a failed delivery shows Retry.

### W6. New ticket and the Chat event

Add `NewTicketSheet` (the spike's `r3-new-ticket.tsx`, built from `ProjectCombobox`, `RunTargetCombobox` reduced to Auto plus hosts, `AgentLaunchPicker`, `ButtonKeyHint`), opened by the Tickets header's +. ⌘↵ submits; Enter is a newline; Esc closes and keeps the draft; Create more reopens the cleared sheet over Chat with Project kept. Add `tmwk.ticketRequest` (D58), the payload on `sendMainNotice`, `TmwkChatEvent` and the system lines (D59), and the partner prompt rules for a request notice. Extend (logged): the one render branch in native chat.

Acceptance: matches `new-ticket-sheet` and `new-ticket-chat`; the partner delegates a real request, and asks first on an ambiguous one (`new-ticket-clarify`).

### W7. Ticket options and status order

Add `TicketOptionsMenu` (the spike's `r3-ticket-options.tsx`, wired), the Own options store (D66), `StatusOrderPopover` with `@dnd-kit/sortable` and ⌥↑↓, Reset to default, the pinned `NeedsYouStrip` for every grouping except Attention, the filters with "Filters never hide what needs you", and filtered-empty (D63).

Acceptance: matches `options-results` and `status-order`; the order survives a reload.

### W8. Validation and docs

Run the [runbook](#validation-runbook), save evidence under `docs/tmwk/m4/`, and land the [doc updates](#doc-updates).

## First-class citizens

- **Cross-platform.** No shell, no paths beyond `node:path` in the store; ⌘↵ uses the platform-aware key hint (Ctrl+Enter on Windows and Linux) and ⌥↑↓ is Alt on both.
- **Remote hosts.** Everything reads from the home host through `callRuntimeRpc` on the chat's target, as the M3 panel does. Owners on other hosts appear with their host only when it explains something.
- **Mobile.** `mobile/**` is Track. Mobile keeps Chat; the request and system lines degrade to Orca's mail card there **(verify)**. A mobile ticket list is deferred.
- **Folder workspaces.** Tickets do not assume a git worktree; Code shows "No branch" for a folder. Folder workspaces stay in the Worktree view (D62).

## Tests

Only where a revert fails them, with hardcoded expectations ([test-antipatterns](../agents-md-refs/test-antipatterns.md)).

| Test                      | Layer                              | Fails if                                                                                                             |
| ------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| v1 store migrates         | Main unit, mkdtemp `TMWK_HOME`     | A v1 snapshot is lost or becomes more than one ticket, or a v2 file is rewritten as v1.                              |
| Failed start is a stop    | Main unit on the ticket store      | A `failed_start` attempt does not make the ticket a stop.                                                            |
| State derivation          | Pure unit on `deriveTicketState`   | A requested ticket with a pending ask is not a decision; an unreachable host hides a question; accepted is not Done. |
| Grouping and filters      | Pure unit on `groupTickets`        | A filter hides a needs-you ticket, the custom status order is ignored, or titles that collide lack a project.        |
| Selection keeps its place | Renderer unit on the list's anchor | A reorder moves the selected row's offset.                                                                           |

Not added: rendering, copy, CSS, RPC wiring and prompt text. Fixtures and the runbook show them.

## Validation runbook

Saved under `docs/tmwk/m4/`. A background dev app (`ORCA_BACKGROUND_LAUNCH=1`) on an isolated profile (fresh user data directory and `TMWK_HOME` outside any scratchpad), driven over CDP; never `show()` or `focus()`. Each screenshot is compared with the spike image named.

| #   | Check                | Evidence                                                                                                 | Spike image          |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | Typical              | Seeded store: 8 tickets, 3 need you (`01-typical.png`)                                                   | `f1-states-a` left   |
| 2   | Busy                 | 18 tickets, 6 need you, colliding titles, one host unreachable; scroll and keyboard pass (`02-busy.png`) | `f1-states-a` right  |
| 3   | Nothing needs you    | `03-nothing.png`                                                                                         | `f1-states-b` left   |
| 4   | Host unreachable     | `04-unreachable.png`                                                                                     | `f1-states-b` middle |
| 5   | Empty                | First launch (`05-empty.png`)                                                                            | `f1-states-b` right  |
| 6   | Ticket open          | Decision pending, sessions disclosed, rail (`06-ticket.png`)                                             | `f1-ticket-open`     |
| 7   | New ticket           | The sheet, then the event and the partner's delegation in Chat (`07-sheet.png`, `07-chat.png`)           | `new-ticket-*`       |
| 8   | Ticket options       | The menu and Group by Project (`08-options.png`)                                                         | `options-*`          |
| 9   | Status order         | The popover and the reordered list with the pinned strip (`09-status-order.png`)                         | `status-order`       |
| 10  | Answer from the card | A real gate answered in one click; the owner continues (transcript)                                      | —                    |
| 11  | Failed delegation    | `ticket start` against a missing repo: a stop in Needs you and a "Couldn't start" line (`11-failed.png`) | —                    |
| 12  | Worktree view        | A folder workspace opened from the Worktree view and back (`12-worktrees.png`)                           | —                    |

Checks 1–6, 8 and 9 can run on a seeded store (a dev-only seed of `tickets.json` and fake fleet rows behind `TMWK_DEV_SEED_TICKETS`) **(verify)**; 7, 10 and 11 need a live partner and owner. Mark a check **Not run** with the reason when it cannot run.

Before every push: `pnpm check:changed`, `pnpm test:ast-grep`, `pnpm verify:rpc-params-catalog` and `pnpm tc`.

## Risks

- **O2 is a store migration.** A bad migration loses ticket history. The v1 guard stays, and the migration writes v2 beside a `.v1.bak`.
- **The native-chat patch (D59)** sits in the most-churned code. It is one branch and drops cleanly.
- **The fleet join** depends on `workerList`'s shape, which upstream reshapes often. It lives in one file and falls back to the record's values.
- **Direct answers (D60)** need tmwk to call as the partner session (W1 found in-process calls are refused otherwise); the fallback is a notice to the partner.
- **Two sidebars.** The Worktree view must stay fully working; nothing in Orca's list changes.

## Deferred

- Mobile ticket list (Track).
- Pausing an attempt (no Orca primitive).
- A tmux-style Watch all grid inside the ticket view; M4 opens the owner's worktree.
- Evidence beside result acceptance beyond the report text and PR link.
- Reconnecting versus suspended host states beyond Paused.

## Doc updates

- **main-chat.md:** tickets are tmwk records (W1); the sidebar, ticket view, New ticket and Ticket options (W3–W7); the CLI surface (`ticket start`, `retry`, `ask`); link this guide under Milestones (this PR).
- **orchestration-ownership-plan.md:** O2 built inside M4 (W1).
- **m3-implementation-guide.md:** D30's panel replaced (W3).
- **fork-ownership.md:** the Extend patch-log lines for W3 and W6, and a decision-log line for D56–D67.
- **`resources/tmwk/main-partner.md`:** `ticket start` (W1), request notices and `ticket ask` (W6).
- Run `pnpm exec oxfmt --write docs/tmwk/m4-implementation-guide.md` before committing.

## W1 results

Built on 2026-11-19 (branch `tykowale/m4-w1-tickets`). The spikes were answered by reading code; none was run live.

### The record as built

`store/tickets.json` is `{ version: 2, counter, tickets: TmwkTicketRecord[] }`, typed and validated by a zod schema in `src/shared/tmwk/tmwk-ticket-record.ts`:

```ts
{
  id: 'tk_<8 hex>', title, words, goal?, projectId?,
  status: 'requested' | 'active' | 'accepted', kind?: 'ongoing', runOn?, agent?,
  source?: { kind: 'linear' | 'jira' | 'github', key, url, title? },   // H0; absent: impromptu
  origin: 'tmwk' | 'orca',            // 'orca': found as an unattached Task in Run main, or a v1 snapshot
  attempts: [{
    runId?, taskId?, dispatchId?, retryOf?, agent?, model?, effort?, host?, worktreeId?,
    repo?, branch?, pr?: { number, url, state: 'open' | 'draft' | 'closed' | 'merged', mergedAt? },
    startedAt, settledAt?, outcome?: 'completed' | 'failed' | 'failed_start' | 'lost',
    failedStage?, failureReason?,
    observed?: { title, status, result, completedAt, question, owner, firstSeenAt, lastSeenAt }
  }],
  question?: { id: 'q_<8 hex>', text, recommend?, askedAt },
  history: [{ at, kind, text, taskId?, dispatchId?, questionId?, briefId? }],
  acceptedAt?, createdAt, changedAt
}
```

Differences from the W1 sketch above:

- **`origin`** is new. A ticket of origin `orca` takes its title from its Task and is dropped, as M3 dropped the snapshot, when its only attempt leaves Orca unfinished. A tmwk ticket keeps the attempt with outcome `lost` (a stop).
- **`runId` and `taskId` are optional** on an attempt: a `failed_start` at `task_create` has neither.
- **History kinds:** `requested`, `brief`, `attempt-started`, `attempt-failed`, `attempt-settled`, `attempt-reopened`, `attempt-lost`, `asked`, `question-closed`, `accepted`, `migrated`. Reports and answers arrive with O3, O4 and W5.
- **The listing.** `tmwk.tickets` returns `TmwkTicketListing` (`src/shared/tmwk/tmwk-tickets.ts`): the M3 snapshot fields of the latest attempt (so the context block, away digest, history and summary are unchanged) plus `id`, `ticketStatus`, `kind`, `attempts`, `dispatchId`, `host`, `agent` and `failure`. `taskId` and `runId` are null before the first attempt, and `status` is `requested` then. `failed_start` and `lost` list as `failed`, a stop.
- **Migration** runs on the first read of a v1 file: one ticket and one attempt per snapshot, `changedAt` and the counter kept so the away and summary watermarks stay valid, the original copied to `tickets.json.v1.bak` (never overwritten). The v1 guard `isTmwkTicket` is kept for that read. Any other version is refused with `tmwk_store_corrupt`.
- **A Task listed before its attempt is attached** (a refresh between `taskCreate` and `ticketAttach`) is folded into the tmwk ticket by `ticketAttach`, so it is never two tickets.
- **The open question** is closed (`question-closed`) by the next attempt. W5's `ticketAnswer` records the answer itself.

### H0 fields

Added on 2026-11-20 from the [ticket history plan](https://github.com/tmwkdev/tmwk-app/blob/tykowale/ticket-tracking-research/docs/tmwk/ticket-history-plan.md#change-o2-before-it-merges), so a ticket keeps what Orca forgets when its Run is retired or its worktree is removed. All are optional; the store stays at version 2, and a file written before them reads unchanged.

- **`agent`, `model`, `effort` per attempt.** `ticket start` and `retry` attach the workerStart receipt's `launch.effective` value for each field, else `launch.requested`, else what the command asked for; a failed start before a receipt records the requested values. `ticketAttach` falls back to the ticket's `agent`, so an attempt started without `--agent` still names one. While the attempt is open, each refresh reads `orchestration.workerShow` (`worker.startOptions.launch`, the same rule) and replaces them. A paired server's attempt keeps its receipt's values: `workerShow` there calls the server.
- **`repo`, `branch` per attempt.** `ticketAttach` reads `worktree.show` for a home-host worktree: `repoId` (tmwk's project id) and `git.branch`. A refresh fills them in for an open attempt whose attach read failed.
- **`pr` per attempt.** A refresh calls `hostedReview.forBranch` (`id:<repo>`, `branch`) for a home-host attempt that is open, or settled less than 3 days ago, or has a PR that is not yet `merged` or `closed`. The PR is kept when a later lookup finds nothing, so it outlives the worktree. Hosts report no merge time: `mergedAt` is the review's `updatedAt` at the first refresh that sees it merged.
- **`source` per ticket.** `tmwk.ticketCreate` takes `source`; `ticket start --source <url>` parses a Linear (`linear.app/<org>/issue/ENG-12`), Jira (`/browse/ENG-12`) or GitHub issue URL (key `owner/repo#12`). Without one, `ticketAttach` copies the target worktree's first linked issue (`linkedWorkItem`, then `linkedItems`; one with no URL is skipped).
- **`settledAt`** is now Orca's Task `completed_at` (set for completed and failed Tasks), and the refresh time only when Orca gives none, or for `lost` and `failed_start`. **Stats rule:** count a ticket once, at its latest completion, using `observed.completedAt` and falling back to `settledAt`; a reopen clears both on the attempt, and `history` keeps the earlier times.
- Every lookup has a 5 s budget and a failed one leaves the attempt as it was; no refresh fails on them. The listing (`TmwkTicketListing`, so `tickets` and `ticketShow`) adds the latest attempt's `model`, `effort`, `repo`, `branch` and `pr`, and the ticket's `source`. A change of `pr` or `source` moves the ticket to a new version.

### RPCs and CLI as built

| RPC                 | Params                                                                                                                                                  | Returns                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `tmwk.ticketCreate` | `{ ticket?, words, title?, goal?, project?, kind?: 'ongoing', runOn?, agent?, source? }`; with `ticket`, revises one with no open attempt               | `{ version, ticket, listing }`                |
| `tmwk.ticketAttach` | `{ ticket, runId?, taskId?, dispatchId?, retryOf?, agent?, model?, effort?, host?, worktreeId?, failedStart?, failedStage?, failureReason?, briefId? }` | the same; a started attempt is refreshed once |
| `tmwk.ticketShow`   | `{ ticket }` (ticket id or any attempt's Task id)                                                                                                       | the same, after a refresh                     |
| `tmwk.ticketAsk`    | `{ ticket, question, recommend? }`                                                                                                                      | the same                                      |
| `tmwk.ticketAccept` | `{ taskId }`, now a ticket id or a Task id                                                                                                              | `{ ticket: listing }`                         |

All call `requireTmwkHomeHost()`. CLI (`src/cli/tmwk/ticket-start-handler.ts`, `ticket-handlers.ts`):

- `orca tmwk ticket start [--ticket <id>] (--goal | --goal-file) --words … [--project] [--agent] [--host <server>] [--title] [--ongoing] [--worktree <placement>] [--name] [--model] [--effort] [--source <issueUrl>] [--evidence]… [--run <runId>]`: resolves the newest Run named `main` (or `--run`), then `tmwk.brief`, `tmwk.ticketCreate`, `orchestration.taskCreate` and `orchestration.workerStart` with the caller's identity (`resolveCoordinatorTerminalHandle` from `src/cli/orchestration/identity/`; a chat session's identity rides the request evidence), then `tmwk.ticketAttach`. `--worktree` defaults to `new-top-level` with `--project` as `repo`; `--host` is `workerStart --on`. A refused brief or a missing Run changes no ticket. A thrown `taskCreate` or `workerStart`, or a receipt whose state is not `ready` or `outcome_unknown`, is attached as `failed_start` with `failedStage` (`task_create`, `worker_start`, or the receipt's) and the command exits 1.
- `orca tmwk ticket retry <id> [--agent] [--worktree]`: `workerStart --task <last task> --retry-of <last dispatch>` on the last attempt's host and worktree (`id:<worktreeId>`), or a new top-level worktree in the ticket's project.
- `orca tmwk ticket show <id>` and `orca tmwk ticket ask <id> --question … [--recommend …]`.

Not passed: worker-start's `devMode` (`isDevCliInvocation` lives in `src/cli/orchestration/recovery/`, which the map does not open to tmwk), so a dev-app owner's preamble names `orca`.

### Spike 1: does `workerStart`'s receipt carry dispatch id, host and worktree id?

- **Dispatch id: yes**, in every receipt with `runId` and `taskId`: ready (`src/main/runtime/rpc/methods/orchestration/worker/start/readiness/worker-start-readiness-settlement.ts:156-171`), outcome unknown (`:126-149`) and failed, which adds `failedStage` and `lastError` (`.../worker/start/worker-start-receipt.ts:100-112`). A failed start returns a receipt; it throws only before a Dispatch exists (admission, Run binding).
- **Host: only for a paired server.** A `--on` receipt carries `server: { environmentId, name }` (`src/main/runtime/orchestration/legacy-remote-home/federated-worker-start.ts:243`; failed ones in `federated-worker-start-receipts.ts:37`). A local receipt names no host, so W1 records none (the home host).
- **Worktree id: not at the top level.** It is the `id` of the `effects` entry with `kind: 'worktree'`: `reused` (`.../worker/start/local-worker-start.ts:151`) or `created_child`/`created_top_level` (`.../worker/start/placement/worker-worktree-creation.ts:166-171`). A remote receipt forwards the server's effects. Every receipt also names its Run (`.../worker/worker-start-method.ts:191-197`).

### Spike 2: can an in-process tmwk caller run `gateResolve` and `reply` on Run `main`?

**No for `gateResolve` and for replies to a question; yes for plain mail and `send`.** The in-process client (`src/main/tmwk/main-session/tmwk-runtime-rpc.ts:49-59`) sends the contract version and `caller: { kind: 'local-cli' }` but no session evidence, so it resolves to no orchestration party.

- `gateResolve` uses `gateResolveAccess` → `coordinatedRunAccess` (`src/main/runtime/rpc/methods/orchestration/access/run-access-rules.ts:29-33`, `:117-130`), which requires the Run's current coordinator (`.../runs/run-scope.ts:146-202`). Without `from` it fails `run_required` (`:156-161`); `from: 'tmwk'` fails `stable_pane_required` (`:167-179`); `from: orca_session_id:<partner>` fails `session_caller_chat_not_declarable` (`src/main/runtime/rpc/orchestration/callers/orchestration-session-caller.ts:200-211`).
- `reply` to a question needs the asked dispatch or the coordinator (`.../messaging/reply-access.ts:63-100`, `helper-question-answerer.ts:17-37`). Plain mail can be replied to by anyone (`reply-access.ts:78-79`).
- `send` from `'tmwk'` has no access rule beyond the contract version (`.../messaging/send-methods.ts:40-47`), as M3 found.
- The only path through is request-level evidence `orchestrationCompatibilityEvidence: { agentSessionId: <pinned partner> }`, which an in-process request may carry (`orchestration-session-caller.ts:101-135`) if the partner's lease is live or released. That is tmwk acting as the partner.

D60 is changed accordingly: see the note under [Decisions](#decisions).

### Spike 3: what does `orchestration.workerList` return for a remote and an unreachable host?

- **Local rows** (`.../worker/worker-list-method.ts:266-286`) carry `dispatchId, taskId, runId, workerState, dispatchStatus, agentTerminalHandle, terminalState, coordinatedFrom, resource` and `projection` (`src/shared/orchestration/fleet/orchestration-fleet-projection.ts:102-130`): `parent.taskId`, `provider`, `host { kind, id }`, `workspace`, `stage`, `liveness`, `evidence.lastObservedAt`.
- **A dispatch on a paired server (`--on`)** is listed from the home host from its own record, without calling the server (`src/main/runtime/orchestration/federation/remote-owned/remote-owned-reads.ts:134-153`, `:168-213`): `dispatchId, taskId, runId, workerState, dispatchStatus` and `server { environmentId, name, asOf, repaired? }`, with **no `projection`**: no provider, workspace, stage, liveness or `parent.taskId`. These rows come on the first page only and are dropped under a `terminalState` filter (`:174-176`).
- **An unreachable paired server** shows the same frozen row; `workerList` has no reachability flag. Only `workerShow` reports `server.reachable` and `lastAnsweredAt` (`remote-owned-reads.ts:59-109`).
- **SSH execution hosts** (`includeRemote: true`) get `projection.host.kind: 'remote'`, and an unreachable one gets `liveness { verdict: 'unverifiable', reason: 'host_unavailable' }` and `evidence.liveStatus: 'unavailable'` (`src/main/runtime/orchestration/legacy-remote-home/federated-fleet-snapshot.ts:200-275`), plus `partialHostErrors` on the page (`worker-list-method.ts:305`).

This changes D57 and D67: see the notes under [Decisions](#decisions).
