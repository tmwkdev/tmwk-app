# Ticket history plan

Status: the owner decided the open questions on 2026-11-20 (see [Decisions](#decisions)). Code references were read on `origin/main` at `6e5d21b968`
and on PR #41 (`tykowale/m4-w1-tickets` at `343fb4b773`). Items not checked in code are marked
**(verify)**.

The question: today tickets are created locally and are effectively ephemeral. Should tmwk use a
Jira, Linear or GitHub board, keep its own ticket stats, or both? The goal is that someone can
say "I completed 20 Jira tickets and 30 impromptu tasks last week."

## Change O2 before it merges

PR #41 makes tickets tmwk records (D35, D56). That fixes the biggest loss: a ticket now outlives
its Orca Run. A few facts are still read **live** from Orca, and they disappear when the Run is
retired or the worktree is removed. Add them to the attempt record now. They are additive,
optional fields, so the store can stay at version 2.

| #   | Gap in PR #41                                                                                                                                                                                                                                                                                | Why history is lost                                                                                                                                                                                                                                                                                                                                                                                        | Add                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ticket start` passes `--model` and `--effort` to `orchestration.workerStart`, but `tmwk.ticketAttach` does not take them (`src/cli/tmwk/ticket-start-handler.ts:131`, `src/shared/rpc-contract/tmwk/tmwk-rpc-params.ts:84-97`). When `--agent` is omitted, the attempt has no agent either. | Orca keeps the requested and effective `{agent, model, effort}` only in `worker_dispatches.start_options` (`src/main/runtime/orchestration/workers/launch/worker-launch-observation.ts:8-15`). That row is deleted with its Run 24 hours after the Run settles (`settled-run-retention.ts:6`). W4's rail reads the model from the live session projection (PR #52), so it shows nothing for an old ticket. | `agent`, `model` and `effort` on the attempt: the requested values at start, replaced by the effective values when a refresh can read them **(verify that an orchestration read exposes `launch.effective`)**. |
| 2   | The attempt keeps only `worktreeId`. W4 gets the branch and PR from `worktree.show` on the owner's host (PR #52).                                                                                                                                                                            | Worktrees are removed after merge, and stale `worktreeMeta` is cleaned up after a 30-day grace period (`src/main/persistence/persistence-flush-and-save-scheduling.test.ts:74`). After that, `worktreeId` names nothing, and "PRs merged" can't be counted.                                                                                                                                                | `branch` and `repo` (the remote, or `projectId`) at attach. Add `pr: { number, url, state, mergedAt? }` when a refresh first sees a PR for the branch, and update it until it reaches a final state.           |
| 3   | Nothing records which external issue a ticket came from.                                                                                                                                                                                                                                     | Orca links a worktree to an issue in `worktreeMeta` (`linkedIssue`, `linkedLinearIssue`, `linkedWorkItem`, `linkedItems`, `src/shared/worktree/meta-types.ts:43-62`). That link goes away with the worktree, and a ticket with no worktree never had one.                                                                                                                                                  | `source?: { kind: 'linear' \| 'jira' \| 'github', key, url, title? }` on the ticket. If it is absent, the ticket is impromptu. At start, copy it from the target worktree's link when there is one.            |
| 4   | `attempt.settledAt` is the time of the refresh that noticed the settle (`merge-live-tasks.ts`, `settledAt: attempt.settledAt ?? now`).                                                                                                                                                       | Refreshes run after main turns. A ticket that finished while the laptop slept gets a `settledAt` hours late.                                                                                                                                                                                                                                                                                               | No new field. Stats use `observed.completedAt` (Orca's time), and fall back to `settledAt`. Write this rule down in the M4 guide so the ticket view and stats agree.                                           |
| 5   | Run retirement deletes worker reports, escalations and messages with the Run.                                                                                                                                                                                                                | `observed.result` keeps the Task's result (`read-live-tickets.ts:95`), but `worker_done` bodies and escalations are lost until O3 lands.                                                                                                                                                                                                                                                                   | Nothing in O2. Keep O3 (reports are tmwk records) directly after M4, not after O5–O7.                                                                                                                          |

Items 1–3 are the must-haves. If O2 merges without them, the tickets created in the meantime will
never get those values back. Item 4 is a documentation fix. Item 5 is an ordering note.

Two smaller notes for O2:

- **Keep version 2 for additive fields.** `readStoreShape` refuses any file whose version isn't the
  one the build expects (`tmwk-store-file.ts` in PR #41). A version 3 bump would make an older
  build on the MBP refuse a store written by a newer laptop build. Unknown fields already survive
  a write, because records are validated, not re-parsed.
- **Reopen keeps its history.** When Orca reopens a Task, the attempt's `settledAt` and `outcome`
  are cleared, and `acceptedAt` is cleared on the ticket. The append-only `history`
  (`attempt-settled`, `attempt-reopened`, `accepted`) still has the earlier times. Stats should
  count a ticket once, at its latest completion.

## What exists today

### tmwk's ticket store

- **On `main` (M3):** `~/.tmwk/store/tickets.json` (`src/main/tmwk/main-home/main-home-paths.ts:13-31`;
  under userData in dev) holds one snapshot per Orca Task in Run `main`
  (`src/main/tmwk/tickets/ticket-snapshot-store.ts`). A Task that disappears unfinished is dropped.
  Finished snapshots are kept with `completedAt` and `acceptedAt`. There is no agent, host, branch,
  PR or source.
- **PR #41 (O2, M4 W1):** version 2 records `{ id: tk_…, title, words, goal?, projectId?, status,
  kind?, runOn?, agent?, origin: tmwk|orca, attempts[], question?, history[], acceptedAt?,
  createdAt, changedAt }` (`src/shared/tmwk/tmwk-ticket-record.ts`). Each attempt has `runId,
  taskId, dispatchId, retryOf, agent, host, worktreeId, startedAt, settledAt, outcome
  (completed|failed|failed_start|lost), failedStage, failureReason, observed`. Nothing deletes a
  tmwk-origin record. An `orca`-origin ticket whose only attempt is lost is dropped
  (`merge-live-tasks.ts`).
- **Writes:** one queue per file, atomic replace, mode `0600`, and an unknown shape is refused
  rather than overwritten (`src/main/tmwk/store/tmwk-store-file.ts`). There's no backup other than
  the one-time `tickets.json.v1.bak`.
- **Where it lives:** only on the home host. Every ticket RPC calls `requireTmwkHomeHost()`
  (`src/main/tmwk/rpc/tmwk-home-host-guard.ts`). Paired servers keep no tickets.

### Orca's orchestration data

- SQLite at `<userData>/orchestration.db` (`src/main/runtime/orchestration/db/orchestration-db-file.ts:4`).
  - `tasks`: status, result, `created_at`, `completed_at`.
  - `dispatch_contexts`: assignee, `failure_count`, `termination_reason`, follow-up.
  - `worker_dispatches`: `start_options` with agent, model and effort.
  - `messages`: worker reports.
- **Lifetime:** an hourly pass deletes a Run with all its Tasks, dispatches and mail once
  everything in it is settled, it has been quiet for 24 hours, and no coordinator is live
  (`db/maintenance/settled-run-retention.ts:6-64`, `orchestration-db-maintenance.ts:13`).
  [main-chat.md](main-chat.md) already concludes that ticket history must live in the tmwk store.

### Orca's tracker integrations

Each integration can already read and write. The ticket skills are thin pointers to the `orca`
CLI. There is no MCP or direct REST from agents.

|            | Auth and storage                                                                                                                                                                                                 | Read                                                                                                                                              | Write                                                                                                                           | Skills                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Linear** | Personal API key per workspace, encrypted with safeStorage in `~/.orca/linear-tokens/*.enc` (`src/main/linear/accounts/linear-credential-paths.ts`, `src/main/credentials/integration-credential-file.ts:30-43`) | List assigned, created or completed; search; read one; comments (`src/main/linear/issues/linear-issue-listing.ts:233`, `linear-issue-lookups.ts`) | Create; update and set status; comment; attach a URL such as a PR (`linear-issue-mutations.ts`, `linear-issue-comments.ts:175`) | `orca-linear` (and the older `linear-tickets`): `linear issue --current`, `status set --current`, `attach --current --url` (`skill-guides/orca-linear.md`) |
| **Jira**   | Cloud: email and API token (REST v3). Server and Data Center: a PAT (v2). Stored in `~/.orca/jira-tokens/*.enc` (`src/main/jira/site-credential-store.ts`). No OAuth **(verify)**                                | JQL search, preset `assignee = currentUser()` lists (`src/shared/jira/jira-preset-jql.ts:9-12`), read, comments, transitions                      | Create, update, transition, comment, assign (`src/main/jira/jira-issue-mutations.ts`)                                           | `orca-jira` and `jira-tickets`. These take an explicit key; there's no `--current` **(verify)**                                                            |
| **GitHub** | `gh` with the bound account (`src/main/git/command-runner/hosted-cli/gh-exec-file.ts`)                                                                                                                           | Issues, timelines, the PR for a branch, merged state, checks (`src/main/github/issues/`, `src/main/github/client/lookup/`)                        | Issue create, update and comment; PR create, merge, review comments; Projects fields (`src/main/github/project-view/`)          | The owner uses `gh` directly                                                                                                                               |

Remote hosts run these integrations with their own `~/.orca` credentials. For SSH workspaces,
Jira falls back to local credentials (`src/shared/jira/jira-source-host.ts:18`).

So tmwk doesn't need a new integration to link, read or write back to a tracker. It needs to
record the link and use Orca's CLI and RPC, as the ownership map requires.

## How the products handle this

- **Trackers record what happened to the ticket.** Each defines "done" differently:
  - Linear: the completed state; Insights is Business and Enterprise only
    (<https://linear.app/docs/insights>).
  - Jira: the Done status category, a JQL `resolved` range.
  - GitHub: the closed date or a closing PR. A closing keyword only links when the PR targets the
    default branch
    (<https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue>).
- **None of them records agent data:** attempts, retries, model, host, cost. Linear models an
  agent as an issue's _delegate_, with Agent Sessions (<https://linear.app/developers/agents>).
  Jira lets you assign work items to coding agents
  (<https://support.atlassian.com/jira-software-cloud/docs/collaborate-on-work-items-with-ai-agents/>).
  In both, the run's detail lives with the agent product.
- **Agent products count sessions and cost, not finished work.**
  - Devin: ACUs per session and a beta per-user session-count API
    (<https://docs.devin.ai/api-reference/v2/user-usage/get-user-usage-analysis-beta>).
  - Copilot coding agent: merged-PR throughput at org level only
    (<https://github.blog/changelog/2026-02-19-pull-request-throughput-and-time-to-merge-available-in-copilot-usage-metrics-api/>).
  - Factory: "Agent Effectiveness" is in private preview.
  - None has a personal "N tasks completed this week" summary; Devin offers a weekly scheduled
    prompt as a do-it-yourself template. That gap is the opening for tmwk.
- **Webhooks need a public HTTPS endpoint** (Linear: <https://linear.app/developers/webhooks>).
  A local-first app would poll with `updatedAt` or JQL `updated >=`. One user's polling fits well
  inside the rate limits: Linear allows 2,500 requests an hour per key, Jira about 65k points an
  hour, GitHub 5,000 points an hour.

## Models compared

|                                    | A. Local only                                                   | B. Tracker is the source of truth                                | C. Hybrid: local record, linked issues                                                                                    |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| What it is                         | tmwk records are the whole history. Stats are computed locally. | Every ticket is a Linear, Jira or GitHub issue. tmwk mirrors it. | Every ticket is a tmwk record. A tracker-backed ticket also has `source` and can write back status, a comment and its PR. |
| Impromptu tasks                    | Counted                                                         | Must create an issue for each one: noisy for the team, and slow  | Counted, with no `source`                                                                                                 |
| "20 Jira + 30 impromptu"           | Only once a link exists                                         | Only if impromptu tasks are filed                                | Yes: group by `source.kind`                                                                                               |
| Agent stats (model, retries, host) | Yes                                                             | Lost, or stuffed into comments                                   | Yes                                                                                                                       |
| Setup                              | None                                                            | An account, a key, a project, workflow mapping                   | None to start. A link per tracker the user already connected in Orca                                                      |
| Offline                            | Works                                                           | Breaks ticket creation                                           | Works. Write-back waits                                                                                                   |
| Privacy                            | Nothing leaves the machine                                      | Goals, user words and results go to a SaaS                       | Only what the user chose to write back, on tickets that already live in that tracker                                      |
| Multi-machine                      | One home host. Copy the store to move                           | The tracker is shared                                            | Like A. The tracker holds the team view                                                                                   |
| Simplicity                         | Simplest                                                        | Adds a required external system                                  | Simple by default. The tracker is an optional add-on                                                                      |

**Recommendation: C, built as A first.** The tmwk record is the source of truth for the user's
work. An external issue is an optional link on a ticket, never a requirement to create one. This
keeps the grokbot and dots feel (say it in Chat, it's a ticket) on top of Orca's power (its
Linear, Jira and GitHub integrations do the tracker work). Model B is wrong for tmwk: most tickets
start in Chat, the agent data has nowhere to go, and it makes an outside account a precondition
for the core loop.

## Counting

- **Completed:** the latest attempt's `outcome` is `completed`. Its time is `observed.completedAt`,
  falling back to `settledAt`. "Completed last week" counts tickets whose latest completion falls in
  the week, one per ticket.
- **Accepted** and **merged** are shown next to it, never instead of it: the user looked at it
  (`acceptedAt`), and its attempt's `pr` reached `merged` (decision 1).
- **Source:** `source.kind` (`linear`, `jira`, `github`), else **impromptu**. An `origin: 'orca'`
  ticket (a Task started outside tmwk) is impromptu unless its worktree had a link.
- **Ongoing tickets** (`kind: 'ongoing'`) don't complete. Count them by what they did: fixes, PRs
  and attempts in the week. They get their own line, never the "completed" number (decision 4).
- **Failures:** `failed`, `failed_start`, `lost`, and the retries before a success.

| Stat                               | From                                                                                      | Recorded today?                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| Completed per week by source       | latest attempt outcome and time, `source`                                                 | Outcome yes. `source` **no** (gap 3)  |
| Cycle time                         | `createdAt` → completion. Active time is first `attempt-started` → completion             | Yes, in `history`                     |
| Owner agent and model              | attempt `agent`, `model`, `effort`                                                        | Agent sometimes. Model **no** (gap 1) |
| Host                               | attempt `host` (absent means the home host)                                               | Yes                                   |
| PRs opened and merged              | attempt `pr`                                                                              | **No** (gap 2)                        |
| Acceptance rate and time to accept | `acceptedAt`                                                                              | Yes                                   |
| Failures and retries               | attempt outcomes, `retryOf`, `failedStage`                                                | Yes                                   |
| Questions asked and answered       | `history` `asked` and `question-closed`                                                   | Yes                                   |
| Cost and tokens                    | not in Orca's orchestration data **(verify whether native chat transcripts carry usage)** | No. Defer                             |

## Durability

- **Restarts and rollovers:** survived. The store is a file under `~/.tmwk`, independent of the
  main session and of Orca Runs (after O2).
- **Growth:** the whole file is rewritten on each change, and `history` is append-only. At about
  50 tickets a week with about 10 events each, a year is roughly 26k events, a few MB of JSON
  **(verify)**. History is kept forever, with no archiving (decision 6). If the single file ever
  gets slow, the fix is a storage change that keeps every record, not pruning.
- **Backup:** none. On macOS, Time Machine includes dotfolders in home by default **(verify)**. Add
  a dated copy of `store/` to the existing rollover or nightly path, and keep the last N copies.
- **Machine changes:** there is one home host, the laptop, and one store (decision 5). Moving
  means copying `~/.tmwk/store`. There is no `homeId`.
- **Automations on the MBP:** the owner expects to run automations on the MBP while the laptop
  stays the home host. Their tickets must land in the laptop's store. Ticket RPCs already refuse a
  runtime that isn't the home host and point at `--environment` (`tmwk-home-host-guard.ts`), so an
  automation creates its ticket on the laptop and places the attempt on the MBP with `--host`.
  Two gaps need design before automations ship:
  - When the laptop is asleep the automation can't create a ticket. It needs to hold the request
    and replay it on reconnect, or start the work and have the laptop adopt it.
  - Refresh reads only Run `main` on the home host. A Task started in the MBP's own
    orchestration DB is never seen, unlike an attempt placed from the laptop **(verify)**.

## Trade-offs to watch

- **Auth:** none new. tmwk uses the connections the user already made in Orca. Linear and Jira
  keys live in `~/.orca` on each host, and a remote host uses its own.
- **Egress:** stats never leave the machine. Write-back sends a short status, a comment and a PR
  link to a tracker the issue already lives in, and only for tickets with a `source`. That is the
  rule the planned identity and egress boundary should state **(verify against that plan, which
  isn't in `docs/tmwk/` yet)**. The [telemetry plan](https://github.com/tmwkdev/tmwk-app/pull/53)
  allows ticket outcomes to leave "maybe, as counts only". This plan adds no telemetry.
- **Ownership map:** all of this is Own code under `src/main/tmwk/` and `src/cli/tmwk/`. Tracker
  calls go through the `orca linear`, `orca jira` and `gh` CLIs or runtime RPC. There are no
  imports from `src/main/linear` or `src/main/jira`.

## Phased plan

1. **H0, in PR #41 before it merges.** Add gaps 1–3 to the record: `agent`, `model`, `effort`,
   `branch`, `repo`, `pr` and ticket `source`. Fill `pr` during refresh. Note gap 4's time rule in
   the M4 guide.
2. **H1, local stats (small, after M4).**
   - `orca tmwk stats [--since 7d] [--by source|agent|host] [--json]` over the store.
   - The partner answers "what did I get done last week?" from it.
   - A weekly line in the away digest, for example "Last week: 12 done (4 Linear, 8 impromptu),
     2 failed, 5 PRs merged."
   - No UI page yet.
3. **H2, link a Linear issue.** Linear comes first (decision 2). Jira and GitHub follow the same
   shape later.
   - `orca tmwk ticket start --issue <LIN-123>` reads the title and URL through `orca linear` and
     sets `source`.
   - New ticket in the UI accepts a pasted Linear issue URL.
   - The owner's preamble names the issue so it can use the `orca-linear` skill it already has.
4. **H3, write-back from intent and a standing preference** (decision 3). There is no setting.
   - The owner saved a standing preference for this. The partner reads intent in Chat. For
     example, "file this ticket for later" creates a Linear issue, or updates the linked one,
     through `orca linear` and sets the ticket's `source`. It doesn't start an owner.
   - On a completed attempt of a linked ticket, the owner attaches the PR and comments the result.
     The status move ("In Review when the PR opens") is the owner's call, informed by the
     preference, as VISION says for "done".
5. **H4, later.**
   - "Assigned to me" from Linear as suggestions in the ticket view.
   - A history view with charts.
   - A store backup (a dated copy of `store/`).
   - MBP automations that land in the laptop's store (see [Durability](#durability)).
   - Cost, if usage data is available.

## Decisions

The owner answered on 2026-11-20.

| #   | Question                                             | Decided                                                                                                                                                                        |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | What counts as "completed"?                          | The owner's `done` report, with accepted and merged shown next to it. "Agree with your recommendation."                                                                        |
| 2   | Which tracker first?                                 | Linear for H2 and H3. "I don't use any day to day but I would gravitate towards linear."                                                                                       |
| 3   | Write-back on by default, or by standing preference? | A standing preference, plus the partner reading intent: "If I say 'File this ticket for later' it'll be obvious it should go to linear." The partner has saved the preference. |
| 4   | Ongoing tickets in the weekly number?                | "It's own line." Never in the completed count.                                                                                                                                 |
| 5   | Two home hosts with their own stores?                | "Not right now." One home host, the laptop. No `homeId` in H0. Automations may run on the MBP, and their tickets must land in the laptop's store.                              |
| 6   | Keep history forever, or archive?                    | "Let's keep it forever now." No archiving.                                                                                                                                     |

H0 is unchanged by these answers. The partner is asking the M4 owner to add its fields to PR #41
before it merges: `agent`, `model` and `effort`; `branch`, `repo` and `pr`; and the ticket
`source`.
