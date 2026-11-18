# Local CI plan: run checks on the always-on Mac and homelab

Status: proposal. Nothing was installed or changed on the MBP; every MBP fact below was observed over `ssh mbp` (read-only) on 2026-11-18.

## Goal

GitHub Actions is disabled on `tmwkdev/tmwk-app` (setting only; the 74 files in `.github/workflows` are kept). We want CI that runs on hardware we already own, started by us rather than by GitHub events, and reports back a pass/fail we can trust before merging.

## What is on the MBP (observed)

| Item              | Observed                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host              | `tys-MacBook-Pro.local`, LAN `192.168.4.30`, up 44 days                                                                                                                                                                                                                                   |
| OS                | macOS 26.7.1 (25G241), SIP enabled                                                                                                                                                                                                                                                        |
| CPU               | Intel Core i7-1068NG7 @ 2.3 GHz, 4 physical / 8 logical cores, **x86_64**                                                                                                                                                                                                                 |
| RAM               | 32 GiB (about 85% free by `memory_pressure`)                                                                                                                                                                                                                                              |
| Disk              | 466 GiB, 379 GiB free                                                                                                                                                                                                                                                                     |
| Power             | `sleep 0` (held off by ChatGPT app and `caffeinate`), `womp 1`, `powernap 1`                                                                                                                                                                                                              |
| Load              | about 2.0 (mostly `mediaanalysisd`; ChatGPT/Codex app running). It is a used machine, not idle                                                                                                                                                                                            |
| Installed         | Apple git 2.50.1, Python 3.9.6, Xcode Command Line Tools (`/Library/Developer/CommandLineTools`), OpenSSH 10.3, nvm with **Node v24.18.0**                                                                                                                                                |
| Missing           | pnpm, npm on PATH (nvm not loaded in non-interactive shells), bun, gh, docker, brew (no `/opt/homebrew`; `/usr/local/Cellar` exists), tmux, tailscale, full Xcode                                                                                                                         |
| GitHub access     | `ssh -T git@github.com` authenticates as `tykowale`; the MBP has its own ed25519 key. Whether that key is a deploy/user key with push rights was not checked                                                                                                                              |
| Existing checkout | `~/tmwk-app` is an **older, unrelated tree** (CLAUDE.md, `src`, `vitest.config.ts`, 13 MB, remote `tmwkdev/tmwk-app`, last commit 2026-10-30) with an untracked `docs/testing-strategy.md`. It is not this Orca-fork layout; do not reuse it. `~/Developer/tmwk/bongo` is another project |

Takeaways: enough RAM and disk, but only 4 physical Intel cores, and it is also someone's working machine. Node 24 matches `package.json` engines (`"node": "24"`). pnpm is pinned to `pnpm@12.14.0` via `packageManager`, so a one-time pnpm install (corepack availability on this Node was not checked) is needed. Runs must be niced and capped (`--maxWorkers=2`, matching the repo default in `check-changed.mjs`).

## What the repo's CI is today

From `.github/workflows` and `package.json`:

- `pr.yml` ("PR Checks") triggers on `pull_request` (opened/synchronize/reopened/ready_for_review/converted_to_draft). Jobs: change detection and repo guards, `preflight` (static analysis and typecheck, 180 min timeout, arm64 Linux), git compatibility, Codex index-heal contract, xterm patch sync, shell contracts, mobile web bundle, cross-version wire, managed hooks on Node 18, `package` (Linux), `package (windows)`, `e2e`, real IME, real WSL terminal, dependency isolation, and a final `verify` gate.
- `unit-tests.yml` is a reusable workflow (`workflow_call`): sharded vitest matrix with a module cache, run on `inputs.runner`.
- Runner labels across all workflows (count of `runs-on` lines): `ubuntu-latest` 30, `ubuntu-24.04` 17, matrix-driven 20, `ubuntu-24.04-arm` 12, `ubuntu-22.04` 11, `windows-2022` 10, `ubuntu-slim` 6, Blacksmith Linux/macOS (paid hosted) about 13, `macos-15` 3, `windows-latest/2025` 5.
- The rest (release, mac/win builds, mobile release, benchmarks, cache sweeps, homebrew bump, labelers, SignPath, R2 mirror) are release or GitHub-bookkeeping workflows.

Local equivalents already in `package.json`: `pnpm tc` (typecheck), `pnpm lint`, `pnpm check:changed` (path-selected gate, parallel, with a pass-hash cache), `pnpm check:code-quality:changed <base>`, `pnpm check:ratchets`, many individual `check:*` scripts, `pnpm test` (vitest), `pnpm build:desktop` / `build:cli` / `build:web` / `build:mobile-web`, `pnpm test:e2e` (Playwright Electron, headless project).

## What can run where

| Check                                                                                                                | MBP (macOS x86_64)                                                                                                                                  | Homelab                                                             | Notes                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm tc` / typecheck                                                                                                | yes                                                                                                                                                 | likely                                                              | Main cost: first-run install and workspace package build                                                                                         |
| `pnpm lint`, oxfmt `--check`, ast-grep gates, ratchets, reliability gates, localization/generation `--check` scripts | yes                                                                                                                                                 | likely                                                              | Node scripts; some use `bun` (`check:import-boundaries`, localization audits, `typecheck:ci`), so install bun or fall back to the `pnpm tc` path |
| `pnpm check:changed`                                                                                                 | yes, as the default per-PR gate                                                                                                                     | likely                                                              | Needs `origin/main` fetched for the merge base                                                                                                   |
| `pnpm test` unit tests (vitest)                                                                                      | yes, `--maxWorkers=2`; CI shards it (60 min limit per shard), so an unsharded run on 4 cores is untested and must be timed first                    | likely (more cores?)                                                | Rebuilds native addons for node runtime (`ensure-native-runtime`), needs Xcode CLT, which is present                                             |
| Mobile web bundle, `build:cli`, `build:web`, Electron-vite build                                                     | yes                                                                                                                                                 | likely                                                              |                                                                                                                                                  |
| Electron e2e (Playwright headless)                                                                                   | probably, but a logged-in GUI session exists and the repo rule is to never steal focus; run only with `ORCA_BACKGROUND_LAUNCH=1` and hidden windows | headless Linux needs xvfb                                           | Defer; flaky and heavy for 4 cores                                                                                                               |
| `package` (Linux), git-compat, Linux shell/wire contracts, `ubuntu-*` jobs                                           | no on macOS where they assume Linux tools (apt, bash specifics)                                                                                     | **yes, the natural home** if the homelab runs Linux x86_64 or arm64 | Needs Docker or a Debian box                                                                                                                     |
| Windows jobs (`package (windows)`, WSL, win e2e, IME)                                                                | **no**                                                                                                                                              | only via a Windows VM                                               | Out of scope for v1; keep a "not covered locally" list in the PR report                                                                          |
| Release / signing / notarization / mac release builds                                                                | not for CI                                                                                                                                          | no                                                                  | Secrets (SignPath, Apple) stay out of this plan; releases remain a manual, separate step                                                         |
| Blacksmith and `macos-15` hosted-runner-specific jobs                                                                | substitutable                                                                                                                                       | substitutable                                                       | Just the runner label changes                                                                                                                    |

Honest coverage: v1 gives Linux-agnostic static analysis, typecheck, unit tests and builds on macOS. It does not give Windows, WSL, IME, signing, or packaged-app confidence. Those stay manual or deferred.

## Design

### Trigger (our side, not GitHub events)

Primary: a script, `scripts/local-ci/run.sh <ref|pr#>`, runnable by us or an agent:

```
ssh mbp 'cd ~/ci/tmwk-app && ~/ci/bin/run-ci <sha> <pr-number>'
```

Options, in order of preference:

1. **Explicit command, run from a dev machine or Orca worker** (`pnpm ci:remote` wrapper around ssh). Zero new services on the MBP, no inbound network. Recommended for v1.
2. **Poller on the MBP** (launchd job every few minutes: `gh pr list` / `git ls-remote`, run CI on new head SHAs of open PRs, skip drafts unless labeled). Needs `gh` or a token. Adds a long-running service, so requires explicit approval.
3. **Webhook** from GitHub to the homelab or MBP. Needs a public endpoint or tunnel. Defer.
4. **Self-hosted GitHub Actions runner** on the MBP, re-enable Actions with `workflow_dispatch` only. Reuses the 74 workflows, but Actions is deliberately off, Linux-only jobs would not match a macOS runner, and it adds a persistent runner agent. Not recommended for v1.

### Execution on the MBP

1. Dedicated checkout under `~/ci/` (not `~/tmwk-app`), a bare mirror plus a fresh `git worktree` per run so runs are isolated and disposable.
2. `git fetch origin <sha>`, check out detached, `nvm use 24`, `corepack enable` (or install the pinned pnpm), `pnpm install --frozen-lockfile` with a persistent pnpm store for speed.
3. Steps, fail-fast order: `pnpm check:changed --base=origin/main` then `pnpm tc` then `pnpm test --maxWorkers=2`. Add `pnpm build:desktop` as a later tier.
4. Wrap in `nice` and a lock file so only one run at a time; per-step timeouts already exist in `check-changed.mjs` (30 min default).
5. Keep logs under `~/ci/runs/<sha>/`; prune old worktrees and keep disk use bounded.

### Reporting back

- **Commit status via GitHub API** (`gh api repos/tmwkdev/tmwk-app/statuses/<sha>` with context `local-ci/mbp`), so the draft/PR page shows pass or fail and a link or note with the log path. Needs `gh` on the MBP and a fine-grained token with `statuses:write` only.
- Fallback with no token: the script returns a non-zero exit, tails the failing step, and the dispatcher (human or Orca agent) posts a PR comment with `gh` from their own machine. This works with zero extra credentials on the MBP.
- If we want branch protection to require it: add a ruleset requiring the `local-ci/mbp` status. Since Actions is off, nothing else produces a check, so this is the only gate.

## What needs to be set up on the MBP (all need approval first)

1. pnpm at the pinned version (corepack or `npm i -g`), plus the nvm default set to 24 for non-interactive ssh (`.zshenv` or an explicit `source ~/.nvm/nvm.sh` in the script).
2. bun (needed by a handful of scripts) and optionally `gh`.
3. `~/ci/` mirror, worktree and pnpm store directories.
4. A scoped GitHub token (statuses only) in the macOS keychain or a 0600 file, if posting statuses from the MBP.
5. Confirm sleep settings stay as they are (`sleep 0`); today that depends on ChatGPT and `caffeinate`, which is fragile. Consider a launchd-managed `caffeinate -s` or `pmset` change, only if the user agrees.
6. Optional: launchd plist for the poller (option 2).

## Open questions for the user

1. Is ~4 cores shared with a logged-in desktop acceptable for CI load, or should heavy tiers (full unit suite, builds) live on the homelab?
2. Which gate is "required to merge" in v1: `check:changed` + `tc` only, or the full unit suite too?
3. Should the MBP post statuses itself (needs a token there), or stay credential-free and report via the dispatcher?
4. Draft PRs: CI on every push, or only on an explicit trigger or label? (The old `pr.yml` skipped some work for drafts.)

## What I need to know about the homelab (no access)

- OS and distro, CPU arch and core count, RAM, free disk, always-on or not.
- Docker/Podman available? Existing orchestrator (Proxmox, k8s, Nomad)? A Debian migration is mentioned in `~/Developer/homelab-debian-migration` on the MBP; its current state would help.
- How the MBP reaches it (ssh alias, Tailscale, LAN), and whether GitHub can reach it (needed only for webhooks).
- Whether it can host Linux x86_64 and/or arm64 jobs, a Windows VM, and xvfb for headless Electron.
- Where secrets can live, and any existing CI/runner (Gitea, Woodpecker, Jenkins, Actions runner) already there.

## Phases

1. **v1 (small):** `scripts/local-ci/run.sh` plus a short README; MBP prerequisites installed with approval; run `check:changed`, `tc`, tests; manual trigger; report by exit code and PR comment. Measure wall-clock and CPU impact.
2. **v2:** commit statuses and a required ruleset; poller or webhook trigger; build tier.
3. **v3:** homelab for Linux-assuming jobs (package, git-compat, contracts), optional Windows VM, e2e under xvfb.

## Fork-ownership note

New files should live in tmwk-owned paths (`docs/tmwk/`, `scripts/local-ci/`). Do not edit the upstream-tracked `.github/workflows` files; they stay as-is while Actions is disabled.
