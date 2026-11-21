# Code quality plan

Research, a recommendation and a prioritised plan for keeping tmwk's code healthy while agents write most of it. The question: which AI review and code-quality tools exist, what of them we could fold into our local checks, and what to change in the code we have.

Status: **decided 2026-11-21, not built; tracked as TMWK-1.** The user's four decisions are recorded under [Decisions](#decisions). Only P0.3 is being built (TMWK-4: the hook, its script and the nightly's p50/p90 line); nothing else is built yet. Measurements were taken on 2026-11-21 at `cc2cbf83e8`. Tool facts and prices were checked the same day; they change often, so each one carries its source.

## Summary

- **Our checks are already strong.** `pnpm check:changed` has 82 check, verify, lint and audit scripts behind it, plus 31 ratchet baselines, type-aware oxlint, ast-grep and a nightly on the MBP. Most of what hosted tools sell (lint, style, SAST-lite, "only new findings") we already run locally for free. The gaps are narrower: some checks never bind, and nothing guards the fork boundary.
- **tmwk's own code is in good shape.** It is about 17.9k lines with 0 `any`, 0 `@ts-` suppressions, 1 lint-disable, 0.15% duplication and 0 forbidden orchestration imports. Its real debts:
  - **Tests:** CLI and UI have almost none.
  - **Coupling:** it imports upstream internals beyond the CLI/RPC seam, mostly native-chat, the fastest-moving code in Orca.
  - **Registry churn:** every feature edits the same few central lists.
  - **Cycles:** 74 of the 76 cycle warnings that turn the nightly red are in `src/main/tmwk`, and one import hub appears in 57 of them.
- **Recommendation (decided: no hosted reviewer for now): no new paid vendor.** Add AI review in the owner's verify step through the agents we already pay for (Claude `/code-review`, and Codex `review` as a second opinion). Add a few free, deterministic checks behind one tmwk entry point. Spend the rest of the effort on the code itself: seams, registry splits and a handful of targeted tests.
- **This follows the product direction:** keep Orca's power, add simplicity. One `pnpm check:tmwk`, one named verify step, and few new tools, each one there because it catches something real here.

---

## Part 1. Research: what is out there

### 1.1 Hosted AI reviewers

| Tool                                        | How it runs                                            | Cost (2026-11)                                                                                                                  | What it checks                                                                                                                                | Usable here without Actions?                                                                                         |
| ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Greptile**                                | GitHub/GitLab app, CLI, MCP; self-hosted on Enterprise | Free: 1 developer, 50 credits/month. Pro: $1/credit, no seats. A review costs 1, 3 or 10 credits ([pricing][greptile-pricing])  | Indexes the whole repo, cross-repo context, learns from feedback                                                                              | **Yes.** `greptile review --agent` reviews the local branch and prints fixes for an agent ([CLI][greptile-cli])      |
| **CodeRabbit**                              | GitHub app, IDE, CLI; self-hosted on Enterprise        | Free: summaries, plus CLI reviews at 3/hour. $24 / $48 / $72 per developer per month ([plans][coderabbit-plans])                | Line-by-line review that folds in linter and SAST output; path instructions; learns from feedback                                             | **Yes.** `coderabbit review --uncommitted`; has a Claude Code plugin ([CLI][coderabbit-cli]). Not bring-your-own-key |
| **Claude Code Review (managed)**            | Claude GitHub App on Anthropic infrastructure          | Token-billed with an org spend cap; Team and Enterprise plans only ([costs][claude-review-costs])                               | Several agents hunt bugs, a verify pass drops false positives, ranked by severity; tuned by `REVIEW.md` / `CLAUDE.md` ([docs][claude-review]) | The local `/code-review` runs on any plan                                                                            |
| **Claude `/security-review`**               | Slash command, or an Action (MIT)                      | Your usage                                                                                                                      | Changed files: injection, auth, secrets, crypto, XSS, with a false-positive filter ([repo][claude-security])                                  | **Yes**, as the local command                                                                                        |
| **OpenAI Codex review**                     | `@codex review` on GitHub; local `/review`             | ChatGPT plans, or an API key at API rates ([pricing][codex-pricing])                                                            | Posts only P0/P1 findings; reads `## Code Review Rules` in AGENTS.md, per directory ([docs][codex-github])                                    | **Yes**, through the CLI                                                                                             |
| **GitHub Copilot review**                   | GitHub-native; the agentic mode runs on Actions        | AI credits plus Actions minutes since 2026-06-01 ([changelog][copilot-actions])                                                 | Agentic review with tools                                                                                                                     | **Poor fit.** Without runners it falls back to a limited review ([docs][copilot-runners])                            |
| **Devin Review**                            | GitHub app; desktop Quick Review                       | Usage-based after a trial. Devin plans start at $20 ([Cognition][devin-plans]); desktop SWE-check is free ([docs][devin-quick]) | PR review UI that groups related changes                                                                                                      | Partly (desktop)                                                                                                     |
| **Graphite Agent**                          | GitHub app plus stacked PRs                            | $20–40 per user ([pricing][graphite])                                                                                           | AI review, chat, custom rules                                                                                                                 | No local CLI found                                                                                                   |
| **Cursor Bugbot**                           | GitHub app                                             | About $1–1.50 per run after 2026-06 ([blog][bugbot])                                                                            | Bug-focused                                                                                                                                   | No                                                                                                                   |
| **Qodo, Sourcery, Ellipsis, Bito, CodeAnt** | SaaS apps                                              | $10–25 per seat; aggregator prices conflict ([Qodo][qodo], [Ellipsis][ellipsis], [Bito][bito], [CodeAnt][codeant])              | General review; CodeAnt adds SAST and SCA                                                                                                     | Not verified                                                                                                         |
| **Korbit**                                  | —                                                      | Listed as dead by CB Insights; unconfirmed ([CB Insights][korbit])                                                              | —                                                                                                                                             | Treat as gone                                                                                                        |

### 1.2 Open-source and bring-your-own-key AI review

| Tool                                                | Status                                                                                                  | How it runs                                                            | Notes                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **PR-Agent** (Qodo, now `The-PR-Agent`)             | Active; 0.50.0 on 2026-11-08; MIT ([repo][pr-agent], [PyPI][pr-agent-pypi])                             | `pip install pr-agent`; any model through LiteLLM, including Anthropic | Mature. Works on a PR URL; a pure local-diff mode is unverified       |
| **Kodus**                                           | Active; vendor says the core is AGPL, GitHub says NOASSERTION ([repo][kodus], [pricing][kodus-pricing]) | Self-hosted or cloud; bring your own key                               | Natural-language "Kody Rules". Check the license before relying on it |
| **Kilo Code Reviewer**                              | Active; MIT                                                                                             | Open source, any model                                                 | Tops Martian's open-source tier by Kilo's own account ([blog][kilo])  |
| **ai-pr-reviewer, villesau/ai-codereviewer, Sweep** | Removed, stale since 2024, or pivoted ([villesau][villesau], [Sweep][sweep])                            | Actions-only or gone                                                   | Skip                                                                  |

### 1.3 Static analysis platforms

| Tool                                     | How it runs                     | Cost                                                                                                             | Checks                                                                    | Local?                                                                      |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **SonarQube Community**                  | Self-hosted server plus scanner | Free; Cloud free up to 50k lines ([docs][sonar], [free tier][sonar-free])                                        | Bugs, smells, duplication, cognitive complexity                           | Yes, but it is a server to run. `eslint-plugin-sonarjs` is the light option |
| **Semgrep CE / Opengrep**                | CLI                             | CE free; the rule pack has its own license; cross-file taint is Pro-only, restored in Opengrep ([docs][semgrep]) | Pattern rules, security                                                   | Yes. Mostly overlaps ast-grep                                               |
| **CodeQL**                               | CLI                             | Private repos need GitHub Code Security ([docs][codeql])                                                         | Deep dataflow and security                                                | Licensing blocks it for a private repo                                      |
| **DeepSource, Codacy**                   | SaaS; Codacy has a local CLI    | Free tiers; about $18–30 per user ([DeepSource][deepsource], [Codacy][codacy], [Codacy CLI][codacy-cli])         | Wrapped linters, AI autofix                                               | Codacy CLI only                                                             |
| **Qlty CLI** (successor to Code Climate) | Rust CLI, Fair Source           | Free, including commercial use ([README][qlty])                                                                  | `qlty smells`: duplication, complexity, nesting, diffed with `--upstream` | **Yes**                                                                     |
| **Trunk Check, MegaLinter**              | CLI or Docker                   | Free; Trunk's web features shut down in 2025-07 ([Trunk][trunk], [MegaLinter][megalinter])                       | Run many linters                                                          | Yes, but they duplicate what we run                                         |
| **reviewdog, Danger.js**                 | CLIs                            | Free ([reviewdog][reviewdog], [Danger][danger])                                                                  | Filter findings to the diff; PR-hygiene rules                             | Yes. We already filter to added lines ourselves                             |

### 1.4 JS/TS tools for structural rot (all free and local)

| Tool                                 | Version, last publish                            | Catches                                                        | Fit here                                                                        |
| ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **knip**                             | 6.47.0, 2026-11-20                               | Unused files, exports and dependencies                         | **Already configured** (`audit:dead-code`, `config/knip.json`); nothing runs it |
| **dependency-cruiser**               | 18.8.0, 2026-11-16                               | Import-graph rules: layers, cycles, orphans ([npm][depcruise]) | Strong for "Own may import upstream only through seam modules"                  |
| **oxlint `import/no-cycle`**         | oxlint 1.94 ([rule][oxc-cycle])                  | Cycles                                                         | **Already configured**, but the diff gate passes `--allow import/no-cycle`      |
| **oxlint type-aware (tsgolint)**     | Stable since 2026-07-22 ([blog][oxc-type-aware]) | `no-floating-promises` and other type-aware rules              | **Already on** (`config/oxlint-code-quality-type-aware.json`)                   |
| **jscpd**                            | 5.4.3, 2026-11-08 ([npm][jscpd])                 | Copy-paste                                                     | Catches the parallel implementations agents write; we have none yet             |
| **type-coverage**                    | 2.31.2 ([npm][type-coverage])                    | Percentage of `any` and implicit `any`; `--at-least` ratchet   | Useful because `noImplicitAny` is `false` repo-wide                             |
| **Stryker** (vitest runner)          | 10.1.1 ([npm][stryker])                          | Tests that assert nothing (mutation testing)                   | Nightly, scoped to Own; agent tests are often weak                              |
| **FTA, cognitive-complexity-ts**     | 3.1.0 / 0.8.2 ([FTA][fta])                       | Per-file and per-function complexity                           | Cheap report; no lint rule for complexity exists today                          |
| **sherif / syncpack**                | 1.13 / 15.3                                      | Monorepo version hygiene                                       | Low value; one root package                                                     |
| **CodeScene CLI**                    | Proprietary ([CLI][codescene])                   | Code Health and hotspots; local `cs delta`                     | Paid, with no free CLI tier found                                               |
| **Stale: ts-prune, madge, betterer** | No release since 2022, 2024-08, 2022             | —                                                              | Use knip, oxlint/dependency-cruiser and our own ratchets instead                |

### 1.5 What the benchmarks say

- **Vendor benchmarks disagree and mostly ignore false positives.** Greptile's own 50-bug benchmark puts Greptile first and does not count false positives ([Greptile][greptile-bench]).
- **Martian Code Review Bench** (independent, open code) scores precision and recall on golden comments and on whether developers acted on comments across 200k PRs. Its leader keeps changing: CodeRabbit, then Greptile at 60.8% F1 (vendor-reported, [Greptile][greptile-martian]), then Cubic online ([DevX][devx]).
- **GitHub ReviewBench** (2026-10, 219 PRs, LLM-graded with 96.6% agreement from senior engineers) ([GitHub][reviewbench]).
- **The most useful result is academic** ([arXiv 2606.15689][arxiv]):
  - Review quality falls with diff size, from F1 0.66 on diffs under 10 lines to 0.04 on diffs over 150 lines.
  - Synthetic bugs overstate real performance (0.847 against 0.066).
  - A small model (Haiku 4.5) beat a larger one at a third of the cost.
  - Recall on performance bugs is near zero.
- **No neutral false-positive rates exist.** A common bar, from Google's Tricorder, is to keep an analyzer only while its effective false-positive rate stays under 10% ([Augment][augment]).

**Takeaway.** For us, which reviewer we pick matters less than **small diffs reviewed before the PR**, with our own rules written down where the reviewer reads them. Deterministic tools catch structural rot more cheaply and reliably than any AI reviewer.

---

## Part 2. What we have, and what to fold in

### 2.1 What already runs

| Layer                | What it runs                                                                                                                                                             | Where                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| pre-commit           | `lint-staged`: oxlint, JS plugins, ast-grep, React Doctor, `oxfmt --write`                                                                                               | `.husky/pre-commit`, `package.json`                                                           |
| pre-push             | **Nothing enforced.** AGENTS.md tells agents to run `pnpm check:changed`                                                                                                 | No `.husky/pre-push`, so husky's dispatcher has nothing to run                                |
| `pnpm check:changed` | Affected typecheck, `vitest related`, oxfmt, oxlint plus anti-slop `--deny-warnings`, findings on added lines only, ratchets, about 20 selected verify checks            | `config/scripts/preflight/changed-checks/check-changed.mjs`, `check-changed-selection.mjs:71` |
| `pnpm lint`          | 47 steps, including whole-tree `audit:code-quality:native --deny-warnings` (the only place cycles fail)                                                                  | `run-lint.mjs:11-59`                                                                          |
| ast-grep             | 17 rules, including `tmwk-no-orchestration-internals`, 6 flaky-test rules, and design-token rules                                                                        | `config/ast-grep/rules`                                                                       |
| MBP nightly          | install, `check:changed --base=<last-green>`, `tc`, `lint`, `test` (diffed against last night), `build:mac`; failures become a failed Task in the home host's `main` Run | `config/tmwk/local-ci/nightly.sh`, [local-ci-plan.md](local-ci-plan.md)                       |
| Owner verify         | The worker preamble says "have a separate agent review the result … then run the checks", **without naming any**                                                         | `src/main/tmwk/worker-instructions/render-worker-preamble.ts:103-104`                         |

**Configured but never run:** `audit:dead-code` (knip), `audit:react-doctor`, `audit:perf`, `check:dependencies`. Some ratchets (react-compiler-compat, render-path-translate and three others) run only through `check:ratchets` or the diff gate's selection, never in `pnpm lint`.

**Not present:**

- complexity, depth or params limits
- duplication detection
- coverage
- a fork-boundary check
- the planned `pnpm tmwk:identity-tripwire` (named in [fork-ownership.md](fork-ownership.md), but no script exists)

**TypeScript settings:** every project inherits `strict`, but with `noImplicitAny: false` and without `noUncheckedIndexedAccess`.

### 2.2 What each candidate would catch here

Each row says what the tool would find in **this** repo today, and where it would run.

| Candidate                                                            | Would catch here                                                                                                                                                              | Run in                                                                   | Verdict                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Gate `import/no-cycle` on Own paths                                  | The 74 tmwk cycles behind today's red nightly, from coming back                                                                                                               | `check:changed` (via `check:tmwk`)                                       | **Adopt** once the nightly-fix ticket lands                                                                      |
| Seam rule (extend the ast-grep rule, or dependency-cruiser)          | Own code importing upstream internals that aren't on an allowlist. Today: `OrcaRuntimeService` methods, `runtime/rpc/core`, and native-chat internals from `MainChatView.tsx` | `check:changed`                                                          | **Adopt.** Start with an allowlist of what exists, and ratchet it down                                           |
| Fork-boundary check                                                  | Track files edited (4 today, none logged), Extend files edited with no patch-log entry, oversized Extend patches (`SidebarFeedbackDialog.tsx` +83/−60)                        | `check:changed` and the sync PR                                          | **Adopt.** Nothing does this now, and it is the rule most likely to rot                                          |
| knip on Own paths                                                    | 5 dead Own exports today (`useTicketOptions`, `attentionSections`, `DEFAULT_TICKET_GROUP_OPTIONS`, two types)                                                                 | Nightly, as a ratchet                                                    | **Adopt.** Already configured                                                                                    |
| jscpd on Own paths                                                   | 0.15% today; catches agents re-implementing an upstream helper                                                                                                                | Nightly report, threshold on Own                                         | **Adopt, cheap**                                                                                                 |
| Claude `/code-review` in owner verify                                | Correctness bugs in the diff, before the PR                                                                                                                                   | Owner verify step                                                        | **Adopt.** Replaces the vague "separate agent review"                                                            |
| Codex `review` as a second model                                     | A second opinion on larger or risky diffs; Codex also reads `## Code Review Rules` in AGENTS.md                                                                               | Owner verify, on request; nightly uses Codex per the standing preference | **Adopt, opt-in**                                                                                                |
| `/security-review`                                                   | Secrets, injection and auth mistakes in egress and identity code                                                                                                              | Owner verify when the diff touches identity, telemetry or feedback paths | **Adopt, scoped**                                                                                                |
| type-coverage on Own                                                 | Implicit `any` that `noImplicitAny: false` lets through                                                                                                                       | `check:tmwk` with `--at-least`                                           | **Trial.** Own has 0 explicit `any`, but implicit ones are unmeasured                                            |
| Stryker on Own logic                                                 | Tests that pass whatever the code does                                                                                                                                        | Weekly nightly job                                                       | **Later**, after the targeted tests in P3 exist                                                                  |
| Complexity report (FTA or a `max-lines-per-function` warning on Own) | `TicketsSidebar` (237-line function), `createTicketStore` (233-line closure)                                                                                                  | Nightly report                                                           | **Trial** as a report, not a gate                                                                                |
| Greptile CLI / CodeRabbit CLI                                        | Repo-wide context and learned rules                                                                                                                                           | Owner verify                                                             | **Skipped for now (decided).** Run a 2-week bake-off later on 10 recent PRs only if `/code-review` misses things |
| PR-Agent / Kodus                                                     | Self-hosted review with our own key                                                                                                                                           | —                                                                        | **Hold.** Same reason, and it is more to run                                                                     |
| SonarQube, Semgrep, CodeQL, MegaLinter, Trunk                        | Mostly duplicates oxlint and ast-grep, or needs a server or license                                                                                                           | —                                                                        | **Skip**                                                                                                         |
| Copilot review, Action-only reviewers                                | Needs Actions                                                                                                                                                                 | —                                                                        | **Skip**                                                                                                         |

### 2.3 How it plugs in without touching upstream

Every new check is tmwk code in `config/tmwk/checks/` (Own) behind **one** command, `pnpm check:tmwk`. _Decided 2026-11-21: register it._ Upstream files get only three small Extend patches: the two registrations below and `.husky/pre-push` (P0.3). All three are unlisted, so they are Track today. Moving each one follows the map's "Changing a path's state" procedure: a map row, a decision-log entry and a line in the [patch log](fork-ownership.md#extend-patch-log).

1. **`package.json`:** the script line `"check:tmwk": "node config/tmwk/checks/check-tmwk.mjs"`, plus the `tmwk:identity-tripwire` alias from P1.5. Nothing has touched `package.json` since the fork, so this is a new Extend row.
2. **`check-changed-selection.mjs`:** one `VERIFY_CHECKS` entry (`{ name: 'tmwk checks', args: [...], inputs: [<Own paths>] }`), so `check:changed` runs it when Own or Extend paths change. The structure exists at `:71`, so this is a registration line, not a restructure. The ratchet auto-discovery (`listRatchetScripts`) scans only `config/scripts`, so it cannot pick up `config/tmwk` without an edit either.

The nightly calls `pnpm check:tmwk --full` (nightly-only checks such as knip and jscpd) from `config/tmwk/local-ci/nightly.sh`, which is Own. The owner verify step is Own too: the worker preamble and `skills/tmwk`.

---

## Part 3. The plan

Most of this work is Own code. Upstream patches stay at a few registration lines: `package.json`, `check-changed-selection.mjs` and `.husky/pre-push`. Each step says what it changes, how we know it is done, and what it depends on.

### Read of the code

| Finding                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Own is small and clean            | 220 files, about 17.9k lines; 0 `any`, 0 `@ts-` suppressions, 1 lint-disable, 0 TODOs; jscpd 0.15%, all in test setup; 0 clones shared with upstream                                                                                                                                                                                                                                                                                                                                   |
| One hub drives the cycles         | `src/main/tmwk/main-session/tmwk-runtime-rpc.ts` is in 57 of the 76 cycle hits. It imports `ALL_RPC_METHODS` from the Extend file `rpc-method-registry.ts`, which imports tmwk's methods back. The **separate nightly-fix ticket owns this fix.** Inside tmwk, madge finds only 2 real cycles: `merge-live-tasks.ts` ↔ `read-task-dispatches.ts` and `tmwk-ticket-record.ts` ↔ `tmwk-tickets.ts`                                                                                       |
| Churn sits in central lists       | Non-merge edits since the fork: `tmwk-rpc-params.ts` 14, `tmwk-command-specs.ts` 11, `tmwk-rpc-methods.ts` 10, `tmwk-handler-group.ts` 9, plus Extend `en.json` 16 and `rpc-params-catalog.generated.ts` 15. Every feature edits all of them                                                                                                                                                                                                                                           |
| Size hot spots at the lint caps   | `TicketsSidebar.tsx` (378/400 counted lines; 237-line component, 13 props), `ticket-store.ts` (293/300; `createTicketStore` is a 233-line closure), `ticket-start-handler.ts` (about 300/300), `NewTicketSheetForm` (13 props)                                                                                                                                                                                                                                                         |
| Thin tests where state lives      | Own files that no test imports: CLI 14 of 14, `main-chat` 50 of 51, `src/main/tmwk` 60 of 92. The largest untested logic: `ticket-start-handler.ts`, `merge-live-tasks.ts`, `ticket-rpc-methods.ts`, `read-live-tickets.ts`, `ticket-v1-migration.ts`, `run-rollover.ts`, `standing-rules-flush.ts`                                                                                                                                                                                    |
| The seam leaks past the CLI/RPC   | Own makes 22 type imports of `OrcaRuntimeService` and calls `showRepo` ×9, `requireStore` ×4, `callOrchestrationWorkerServer`, and others. It has value imports from `runtime/rpc/core` (13), `rpc/dispatcher` and `agent-session/installation`. `MainChatView.tsx` imports native-chat internals (`NativeChatView`, composer editor and host-outage owners); native-chat had 880 upstream commits in 30 days. Ticket UI imports sidebar internals (`WorktreeCard`, `StatusIndicator`) |
| Ownership map drift               | 4 Track files edited (test companions of Extend patches, such as `lifecycle-reconciliation.test.ts` +47) and not listed. The `store/slices/ui/**` and `app-shell/**` Extend globs hide 6 touched files that have no patch-log entry. `SidebarFeedbackDialog.tsx` is a rewrite, not a patch                                                                                                                                                                                             |
| The nightly is red (context only) | Lint fails on the cycles above. 32 unit files fail, none in tmwk. The separate nightly-fix ticket owns both                                                                                                                                                                                                                                                                                                                                                                            |

### P0. Make the checks we have bind (about 1 day)

**P0.1 Name the verify step.** [TMWK-2] In `render-worker-preamble.ts` and `skills/tmwk` (both Own), replace "run the checks" with an explicit list:

- `pnpm check:changed`, which will include `check:tmwk`. It is the full gate and slow (656s on the MBP for a 20-file diff, almost all unit tests), so it runs here, not in the P0.3 pre-push hook
- `pnpm tc`
- `/code-review` (or the agent's equivalent) on the branch diff

Add `/security-review` only when the diff touches identity, telemetry, feedback or egress paths. Each finding is either fixed or answered in the report.

- _Verify:_ the rendered preamble (and its test, if one exists) shows the list. Read the next few owner reports to confirm they name the checks they ran.

**P0.2 Write our review rules down where reviewers read them.** [TMWK-3] Add a short `## Code Review Rules` section inside the existing tmwk section of `AGENTS.md`. `AGENTS.md` is Extend, so the change also goes on its patch-log line. Codex review and local `/code-review` (which loads AGENTS.md here) read it. Cover:

- fork states
- no orchestration internals
- the tests rule
- small diffs
- the identity seam

Keep it to about 10 lines.

- _Verify:_ run `/code-review` on a branch that edits a Track file; it flags the edit.

**P0.3 A fast pre-push hook (decided: under 30s).** [TMWK-4] _Decided 2026-11-21:_ "quick checks as a pre push hook … less than 30s … keep it fast".

`pnpm check:changed` cannot be the hook. On the MBP it took **656s** for a 20-file tmwk diff; unit tests alone took 654s, and five ratchets took 30–55s each. So the hook runs a fixed subset, and `check:changed` stays the full gate in the owner verify step (P0.1) and the nightly.

**The hook.** `.husky/pre-push` has one line, `node config/tmwk/checks/check-prepush.mjs`:

- The script is Own. It needs no new `package.json` line.
- `.husky/pre-push` becomes a new Extend row, with a decision-log entry and a patch-log line. Upstream has no pre-push hook, so it should rarely conflict.
- `HUSKY=0` skips it, for people only. Agents must not set it, and AGENTS.md's "never `--no-verify`" still applies.
- A hook in `.git/hooks` would never run here: `core.hooksPath` is `.husky/_`, and `pnpm install` (`prepare: husky`) resets it.

The script finds the files changed since the merge base with `origin/main`, using the same base rules as `check:changed`. Like `check:changed`, it checks the working tree, not the pushed commits; this is deliberate. It runs these steps in parallel, and the first failure cancels the rest:

| Step          | What it runs                                                                                                               |                                                                  MBP, warm |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------: |
| Format        | `oxfmt --check` on changed files                                                                                           |                                                                       0.3s |
| Lint          | `oxlint --quiet` on changed files                                                                                          |                                                                       0.3s |
| Anti-slop     | anti-slop oxlint `--deny-warnings` on changed files                                                                        |                                                                       0.2s |
| ast-grep      | `ast-grep scan --min-severity warning` on changed files (includes `tmwk-no-orchestration-internals`)                       |                                                                       0.2s |
| Cycles        | oxlint with its own `config/tmwk/checks/oxlint-no-cycle.json` (only `import/no-cycle`), **changed files only**             |                                                                       1.0s |
| Fork boundary | `node config/tmwk/checks/check-tmwk.mjs --fast`: the P1.3 boundary check and the P1.4 seam rule on the diff, once P1 lands |                                                            ~1s (estimated) |
| Typecheck     | `pnpm tc` (node, web, cli, pane-launch, process-host)                                                                      |                                                                 17.6–17.9s |
| **Total**     |                                                                                                                            | **about 20s** (sum of single runs; the parallel total is not yet measured) |

A docs-only diff skips typecheck and finishes in about 2s.

P0.3 ships without the Fork boundary step; P1.3 and P1.4 add it. The Cycles step blocks new cycles now, without waiting for P0.4. It fails only on a cycle not already present at the merge base, where an import of the same specifier in the base file counts as existing, so the 76 existing cycles in 29 files do not block a push.

**How the subset is chosen.** A check goes in only if it passes all four tests:

1. It is deterministic: no network, no model, no flaky timing.
2. It catches a whole class of error that CI-off would otherwise let reach main: format, lint, a banned import, a cycle, a type error, a fork-rule break.
3. It scales with the diff, not the repo. The exception is typecheck, which is whole-project but bounded.
4. Its warm p90 on the MBP keeps the parallel wall time at or under 25s, leaving 5s of headroom.

**Left out, on purpose:**

- **Unit tests.** `vitest related` took 125s warm and 215s cold for 71 files, about 145s of the cold run is startup. Critical fast tests are left out too, until a measured run fits: reconsider only if a measured run of the P3 tests alone comes in under 8s.
- **The changed-code quality script.** About 11s, and it competes with `tc` for the MBP's 4 cores. The parallel total with it is unmeasured, so it stays out until a measured run fits.
- **The ratchets.** 30–55s each.
- **Whole-tree no-cycle**, which needs a baseline first.

All of these stay in `check:changed` and the nightly.

**How the time is measured:**

- Each run prints a per-step and total wall time.
- Each run appends one line to `<home>/.cache/tmwk/prepush-times.jsonl` (built with `os.homedir()`, so it works on Windows): date, files changed, per-step and total seconds, and the machine.
- The budget is **30s wall on the MBP**: an Intel i7-1068NG7, 4 cores, the slowest host. Typecheck there falls back to `bun check`, because tsrs supports only arm64 macs and Linux, so the Air will be faster.
- Over 30s, the hook warns but still passes, so a slow machine never blocks a push.
- The nightly runs the script against the last 10 non-merge commits on main, each diffed against its parent, and reports p50 and p90. It reports two lines, all runs and typecheck runs only, because docs-only and fail-fast runs skew the first low. A p90 over 30s on two nights in a row should open a nightly Task to trim the subset; for now it is only reported, and the auto-Task is a follow-up. The usual first trim is swapping `pnpm tc` for `tc:node` (about 12s).

**Verify:**

- Pushing a branch with an oxfmt error, a new cycle or a type error is refused, each in under 30s.
- A docs-only push takes under 5s.
- The nightly's p90 line appears in its report.

**P0.4 Depends on the nightly-fix ticket.** [TMWK-5] Do not duplicate it. When it lands, re-run the nightly, confirm green, and add the results to the Status line here.

### P1. One tmwk check entry point (about 2 days)

**P1.1 `config/tmwk/checks/check-tmwk.mjs`** [TMWK-6] plus the Extend registrations in §2.3. Its default mode runs fast checks on changed Own and Extend paths; `--full` runs everything for the nightly. Reuse the existing ratchet library (`config/scripts/static-analysis/ratchet-baseline/ratchet-baseline.mjs`) rather than writing a new one.

- _Verify:_ `pnpm check:changed` on a branch that touches `src/main/tmwk` lists "tmwk checks" in its steps; on a docs-only branch it does not.

**P1.2 Cycles gate on Own.** [TMWK-7] Run oxlint with only `import/no-cycle` (`--deny-warnings`) on Own paths. The diff gate allows `import/no-cycle` on purpose, to match CI, which cannot see mobile cycles; `check:tmwk` gates it on Own paths only.

This needs a green start. The nightly-fix ticket clears the registry-hub cycles. If it leaves the two cycles inside tmwk (`merge-live-tasks.ts` ↔ `read-task-dispatches.ts`, `tmwk-ticket-record.ts` ↔ `tmwk-tickets.ts`), fix them in this step.

- _Verify:_ a scratch branch adding `a.ts` ↔ `b.ts` under `src/main/tmwk` fails `check:tmwk`.

**P1.3 Fork-boundary check.** [TMWK-8] Compare `git diff <base>` with the path table in `fork-ownership.md`. Parse the existing map; do not create a second list.

Classifying a path:

- Take the backticked tokens from the Path column.
- The most specific match wins.
- `(rest)` rows and unlisted paths fall back to Track.
- A test file next to an Extend file inherits Extend, and that file's patch-log entry covers it.

The rules:

- A Track path that changed is an error.
- A changed Extend path is covered when its path or basename appears in the patch log; otherwise it is an error.
- An Extend diff over about 40 lines is a warning. Measure it against `git merge-base HEAD upstream/main`, because the fork point moves with each sync.

- _Verify:_ run against `f1e1f44779..HEAD`, it reports today's 4 unlogged test edits next to Extend files and the 6 unlogged `ui/**` and `app-shell/**` files. A clean branch passes.

**P1.4 Seam rule.** [TMWK-9] Extend `tmwk-no-orchestration-internals` (or add a sibling ast-grep rule) to allow upstream imports from Own only through a listed set of seam modules. Seed the list with today's imports as a ratchet baseline, so the list can only shrink.

- _Verify:_ a new `import … from '…/native-chat/…'` in `main-chat` fails; existing imports pass until P2.3 moves them.

**P1.5 Identity tripwire.** [TMWK-10] Build the planned tripwire (identity guide I2) inside `check-tmwk.mjs`, so it is not a second tool. Keep the documented name `pnpm tmwk:identity-tripwire` as a second script line that calls `check-tmwk.mjs --identity`, so `fork-ownership.md` and the identity guide stay correct.

- _Verify:_ as the [identity-egress-guide.md](identity-egress-guide.md) defines it.

### P2. Fix the structure where churn and risk meet (about 1 week, ticket by ticket)

**P2.1 Split the central tmwk lists by domain.** [TMWK-11] `tmwk-rpc-params.ts`, `tmwk-command-specs.ts`, `tmwk-rpc-methods.ts` and `tmwk-handler-group.ts` become per-domain files (tickets, main session, history, preferences) with a thin index. A feature then edits its own domain file, not four shared ones. This also takes pressure off the Extend generated catalog.

- _Verify:_ `pnpm tc`, the `rpc params catalog --check`, and the existing RPC tests pass. A follow-up feature PR touches one params file, not the shared one.

**P2.2 Break up the files at the lint caps.** [TMWK-12]

- `TicketsSidebar.tsx`: move the list, the keyboard hook and the header into their own files, and group the 13 props into a view-model object.
- `ticket-store.ts`: split `createTicketStore` into read, write and migration modules.
- `ticket-start-handler.ts`: separate argument parsing from the start flow.
- `NewTicketSheetForm`: give it a form-state hook.

Where P3 covers a module (`ticket-start-handler.ts`), land its test before the split. The UI splits rely on component fixtures.

- _Verify:_ no Own file above 90% of its `max-lines` cap; `pnpm lint` and the component fixtures (`pnpm fixtures:shot`) show no visual change.

**P2.3 Put Orca behind named seams.** [TMWK-13] Create one Own adapter per upstream area tmwk uses, for example `src/main/tmwk/orca-seam/runtime.ts` and `src/renderer/src/components/main-chat/orca-seam/native-chat.ts`. Each re-exports or wraps exactly what tmwk uses: `showRepo`, `requireStore`, the RPC core helpers, `NativeChatView`, the composer and outage owners, `WorktreeCard`. All Own code imports only through these. After an upstream sync, a break shows up in one file per area instead of across many.

- _Verify:_ the P1.4 baseline shrinks to the seam files only. A test sync merge from `upstream/main` in a scratch worktree resolves in the seam files.

**P2.4 Clean up the ownership map.** [TMWK-14]

- Narrow the `store/slices/ui/**` and `app-shell/**` Extend globs to per-file rows.
- Record the "tests next to an Extend file are Extend" rule in the map, which covers the 4 Track test edits.
- Either bring `SidebarFeedbackDialog.tsx` back to a shim that forwards to an Own component, or move it to Adopted with a reason.
- _Verify:_ the P1.3 check passes over `f1e1f44779..HEAD` with no exemptions.

**P2.5 Delete the 5 dead exports,** [TMWK-15] then turn on knip for Own paths in `check:tmwk --full` as a ratchet.

- _Verify:_ knip reports 0 unused Own exports, and the nightly runs it.

### P3. Tests only where they pay (alongside P2)

Linear: TMWK-16.

AGENTS.md says no tests by default. Add tests only where state can be corrupted or a migration can lose data, at the layer that owns the behavior:

- **`ticket-v1-migration.ts`:** old records in, new records out, with hardcoded fixtures.
- **`merge-live-tasks.ts` and `read-live-tickets.ts`:** merging live Orca tasks into tickets. This is where reports went missing before (#67).
- **`run-rollover.ts` and `standing-rules-flush.ts`:** nothing lost across a rollover.
- **`ticket-start-handler.ts`:** the CLI argument contract. This is the only CLI test, because the CLI is the stable seam other hosts depend on.

No UI tests beyond component fixtures. _Verify:_ each test fails when its module's fix or behavior is reverted, which is the AGENTS.md bar.

### P4. Later, and only if it earns its place

- **Mutation testing:** weekly Stryker on the P3 modules in the nightly, to see whether those tests catch anything. Drop it if the scores are high and stable.
- **Type coverage:** add type-coverage `--at-least` on Own (P1 trial). Keep it if it finds real implicit `any`; drop it if it stays at 100%.
- **Complexity report:** run FTA, or a `max-lines-per-function` warning on Own only, as a nightly report. Promote it to a gate only if hot spots grow back after P2.2.
- **Hosted reviewer bake-off** (_skipped for now_, decision 3): run Greptile CLI (`--agent`, about $1–3 a review) and the CodeRabbit CLI free plan beside `/code-review` on 10 recent tmwk PRs. Count real bugs found against noise. Adopt one only if it finds what ours missed with under 10% noise.
- **TypeScript strictness for Own:** a tmwk tsconfig overlay in `config/tmwk/` with `noImplicitAny` and `noUncheckedIndexedAccess`, typechecked by `check:tmwk`. Upstream's configs are left alone.

### Order and owners

| Step           | Depends on                                                                        | Size   | Agent                                                    |
| -------------- | --------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| P0.1–P0.3      | — (P0.3's fork-boundary step: P1.3, P1.4; its cycles step blocks only after P0.4) | S      | owner                                                    |
| P0.4           | nightly-fix ticket                                                                | —      | —                                                        |
| P1.1–P1.5      | P0.4 for a green baseline; P1.2, P1.3 and P1.5 build on P1.1                      | M      | owner                                                    |
| P2.1, P2.2, P3 | P1.1                                                                              | M each | owners in parallel; P3 tests land before each P2.2 split |
| P2.3, P2.4     | P1.3, P1.4                                                                        | M      | owner                                                    |
| P2.5           | P1.1                                                                              | S      | owner                                                    |
| P4             | P2 done                                                                           | —      | nightly items on Codex (standing preference)             |

Each P-step is its own ticket and its own small PR. That keeps diffs under the size where review stops working (§1.5).

## Decisions

The user decided these on 2026-11-21:

1. **Pre-push:** "quick checks as a pre push hook … less than 30s … keep it fast." This is the fast subset in P0.3, not `check:changed`.
2. **`check:tmwk` registration:** "Let's register it." This means both Extend registrations in §2.3: the `package.json` script lines and the `check-changed-selection.mjs` entry.
3. **Hosted reviewer:** "Skip for now." No vendor, and the P4 bake-off stays parked.
4. **Linear:** "Yea create linear tickets for these." Filed in the TMWK team: parent TMWK-1; P0.1–P0.4 are TMWK-2 to TMWK-5, P1.1–P1.5 are TMWK-6 to TMWK-10, P2.1–P2.5 are TMWK-11 to TMWK-15, and P3 is TMWK-16. Each step above carries its id.

## Sources and gaps

Every source is linked inline in the tables above (reference definitions follow).

[greptile-pricing]: https://www.greptile.com/pricing.md
[greptile-cli]: https://www.greptile.com/docs/code-review/greptile-cli
[greptile-bench]: https://www.greptile.com/benchmarks.md
[greptile-martian]: https://www.greptile.com/content-library/greptile-martian-code-review-benchmark
[coderabbit-plans]: https://docs.coderabbit.ai/management/plans.md
[coderabbit-cli]: https://docs.coderabbit.ai/cli
[claude-review]: https://code.claude.com/docs/en/code-review
[claude-review-costs]: https://code.claude.com/docs/en/code-review-costs
[claude-security]: https://github.com/anthropics/claude-code-security-review
[codex-pricing]: https://learn.chatgpt.com/docs/pricing.md
[codex-github]: https://learn.chatgpt.com/docs/third-party/github.md
[copilot-actions]: https://github.blog/changelog/2026-04-27-github-copilot-code-review-will-start-consuming-github-actions-minutes-on-june-1-2026/
[copilot-runners]: https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-runners
[devin-plans]: https://cognition.com/blog/new-self-serve-plans-for-devin
[devin-quick]: https://docs.devin.ai/desktop/quick-review
[graphite]: https://graphite.com/pricing
[bugbot]: https://cursor.com/blog/may-2026-bugbot-changes
[qodo]: https://www.qodo.ai/pricing/
[ellipsis]: https://www-origin.ellipsis.dev/blog/usage-based-pricing
[bito]: https://bito.ai/pricing/
[codeant]: https://www.codeant.ai/pricing
[korbit]: https://www.cbinsights.com/company/korbitai
[pr-agent]: https://github.com/qodo-ai/pr-agent
[pr-agent-pypi]: https://pypi.org/project/pr-agent/
[kodus]: https://github.com/kodustech/kodus-ai
[kodus-pricing]: https://docs.kodus.io/how_to_use/en/pricing
[kilo]: https://blog.kilo.ai/p/martians-independent-benchmark-tested
[villesau]: https://github.com/villesau/ai-codereviewer
[sweep]: https://github.com/SweepAI/sweep
[sonar]: https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/languages/javascript-typescript-css
[sonar-free]: https://www.sonarsource.com/blog/the-new-sonarqube-free-tier-is-here/
[semgrep]: https://semgrep.dev/docs/faq/comparisons/opengrep
[codeql]: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/about-the-codeql-cli
[deepsource]: https://docs.deepsource.com/docs/platform/reference/billing
[codacy]: https://www.codacy.com/pricing
[codacy-cli]: https://docs.codacy.com/codacy-analysis-cli/
[qlty]: https://raw.githubusercontent.com/qltysh/qlty/main/README.md
[trunk]: https://trunk.io/changelog/sunsetting-ci-analytics-and-code-quality-web-issue-browser
[megalinter]: https://oxsecurity.github.io/megalinter/beta/mega-linter-runner/
[reviewdog]: https://pkg.go.dev/github.com/reviewdog/reviewdog
[danger]: https://danger.systems/guides/faq
[depcruise]: https://www.npmjs.com/package/dependency-cruiser
[oxc-cycle]: https://oxc.rs/docs/guide/usage/linter/rules/import/no-cycle
[oxc-type-aware]: https://oxc.rs/blog/2026-07-22-type-aware-linting-stable
[jscpd]: https://www.npmjs.com/package/jscpd
[type-coverage]: https://www.npmjs.com/package/type-coverage
[stryker]: https://www.npmjs.com/package/@stryker-mutator/vitest-runner
[fta]: https://www.npmjs.com/package/fta-cli
[codescene]: https://codescene.io/docs/cli/command-reference.html
[devx]: https://www.devx.com/coding/what-is-reviewbench-ai-code-review-benchmark/
[reviewbench]: https://github.blog/ai-and-ml/reviewbench-an-open-benchmark-for-ai-code-review/
[arxiv]: https://arxiv.org/abs/2606.15689
[augment]: https://www.augmentcode.com/guides/ai-code-review-accuracy

Not verified:

- Claude Code Review's per-review price
- Bugbot's official rate card
- whether PR-Agent can review a local diff
- Kodus's exact license
- current Qodo, Sourcery, Bito and CodeAnt prices
- Korbit's shutdown
- CodeScene's CLI price
- Martian's live leaderboard (seen only through secondary reports)

Code measurements came from madge, jscpd, `git log` and `git diff` against the fork point `f1e1f44779`, and the repo's own `audit:code-quality:native`.
