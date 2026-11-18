# Local CI plan: run checks on the always-on MacBook Pro

Status: proposal. Decision from the owner: **the MBP (`ssh mbp`) is the default CI host**; the homelab is not needed now, and Linux and Windows jobs are deferred. MBP facts were observed over `ssh mbp` on 2026-11-18. The only changes made there were by the owner's request to time a full unit run (see [What was changed on the MBP](#what-was-changed-on-the-mbp)).

## Goal

GitHub Actions is disabled on `tmwkdev/tmwk-app` (setting only; the 74 files in `.github/workflows` are kept). We want CI that runs on hardware we already own, started by us rather than by GitHub events, and reports a pass/fail we can trust before merging.

## What is on the MBP (observed)

| Item            | Observed                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host            | `tys-MacBook-Pro.local`, LAN `192.168.4.30`, up 44 days                                                                                                                         |
| OS              | macOS 26.7.1 (25G241), SIP enabled                                                                                                                                              |
| CPU             | Intel Core i7-1068NG7 @ 2.3 GHz, 4 physical / 8 logical cores, **x86_64**                                                                                                       |
| RAM             | 32 GiB (about 85% free by `memory_pressure`)                                                                                                                                    |
| Disk            | 466 GiB, 379 GiB free before the test run; `~/ci` is now 3.5 GiB                                                                                                                |
| Power           | `sleep 0`. A launchd agent `com.local.ssh-awake` (`/usr/bin/caffeinate -s`, `KeepAlive`) is loaded, so staying awake does not depend on the ChatGPT app. `womp 1`               |
| Load            | about 2.0 at idle (`mediaanalysisd`, ChatGPT/Codex app). A used machine with a logged-in desktop, not an idle server                                                            |
| Installed       | Apple git 2.50.1, Python 3.9.6, Xcode Command Line Tools, OpenSSH 10.3, nvm with **Node v24.18.0**, corepack 0.35.0 (bundled with that Node)                                    |
| Not installed   | bun, gh, docker, brew, tmux, tailscale, full Xcode. pnpm exists only as a corepack shim in `~/ci/bin` created for the test run; nvm is not loaded in non-interactive ssh shells |
| GitHub access   | `ssh -T git@github.com` authenticates as `tykowale` with the MBP's own ed25519 key; the clone of `tmwkdev/tmwk-app` worked. Whether that key can push was not checked           |
| Other checkouts | `~/tmwk-app` is an **older, unrelated tree** (last commit 2026-10-30). Do not reuse it. `~/Developer/tmwk/bongo` is another project                                             |
| Sudo            | `sudo` needs a password, so anything needing root is a manual step for the owner                                                                                                |

## Measured: full unit run on the MBP

`pnpm test --maxWorkers=2` under `nice -n 10`, at main `887f5c3`, 2026-11-18:

- Install (`pnpm install --frozen-lockfile`): 54 s. Clone: 78 s.
- Tests: **2,782 s (46.4 min)**. 3,793 files passed, 17 failed, 109 skipped (3,919); 16,223 tests passed, 15 failed, 435 skipped.
- GitHub Actions for Orca (`stablyai/orca`, PR run 44359673202): 12 shards on 4-vCPU runners, each 200 to 254 s of test time, about 5 min wall and about 44 min of total runner time. The MBP does the same work in about 9 to 10 times the wall time because it has no parallel shards.
- The 17 failing files were not investigated. They include `native-process-spawn`, `release-checkout`, `process-host-dev-rebuild`, `macos-terminal-host-bundle`, `packaged-cli-assets`, `reclaim-worktree-generated-files`, `pr-auxiliary-preflight-admission` and `dependency-security-release`. Treat them as an unproven baseline: phase 1 below triages them.
- The fast tier (`check:changed` plus `pnpm tc`) has **not been timed yet**.

## What the repo's CI is today

From `.github/workflows` and `package.json`:

- `pr.yml` ("PR Checks") runs on `pull_request`. Jobs: change detection and repo guards, `preflight` (static analysis and typecheck), git compatibility, Codex index-heal contract, xterm patch sync, shell contracts, mobile web bundle, cross-version wire, managed hooks on Node 18, `package` (Linux), `package (windows)`, `e2e`, real IME, real WSL terminal, dependency isolation, and a final `verify` gate.
- `unit-tests.yml` is a reusable workflow: sharded vitest matrix (12 shards for a full run).
- Release, signing, mac/win build, mobile release, benchmark, cache-sweep and labeler workflows are separate and not part of PR gating.

Local equivalents in `package.json`: `pnpm tc`, `pnpm lint`, `pnpm check:changed` (path-selected gate with a pass-hash cache and `--base=<ref>`), `pnpm check:code-quality:changed <base>`, `pnpm check:ratchets`, many `check:*` scripts, `pnpm test`, `pnpm build:desktop`, `pnpm test:e2e`.

## Scope with the MBP as default host

| Tier                | What runs                                                                                                 | In scope now              |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------- |
| **fast**            | `pnpm check:changed --base=origin/main`, `pnpm tc`                                                        | yes, every trigger        |
| **full**            | fast, plus `pnpm test --maxWorkers=2` (about 46 min), minus the triaged known-environment failures        | yes, on demand + nightly  |
| **build**           | `pnpm build:desktop` (typecheck, CLI, electron-vite, web, mobile web)                                     | yes, later phase          |
| **e2e**             | Playwright Electron, headless. Needs `ORCA_BACKGROUND_LAUNCH=1` and no focus stealing on the live desktop | deferred                  |
| **Linux/Windows**   | `ubuntu-*` jobs, `package`, git-compat, shell/wire contracts, Windows, WSL, IME                           | deferred (owner's call)   |
| **Release/signing** | notarization, SignPath, publish                                                                           | never in CI; stays manual |

What the v1 gate does not tell you: anything about Linux, Windows, packaged apps, or e2e behavior. State this in each report.

## Design

**Host layout (on the MBP, under `~/ci`)**: one bare mirror of `tmwkdev/tmwk-app`, one fresh `git worktree` per run at the requested SHA, a shared pnpm store, logs at `~/ci/runs/<sha>-<tier>/`. The existing `~/ci/tmwk-app` clone from the timing run becomes the mirror's seed or is deleted.

**Trigger**: a script, `scripts/local-ci/run.sh <sha|branch|pr#> [fast|full|build]`, run from a dev machine or an Orca agent as `ssh mbp '~/ci/bin/run-ci ...'`. No new service and no inbound network for v1. A launchd poller that watches open PRs comes in a later phase.

**Run steps**: take a lock (one run at a time), `git fetch`, add worktree at the SHA, load nvm and Node 24, `pnpm install --frozen-lockfile` against the shared store, run the tier under `nice -n 10` with `--maxWorkers=2`, write logs, remove the worktree, prune runs older than N days.

**Reporting**: the script exits non-zero and prints the failing step's last 200 lines. If a token is present on the MBP it also posts a commit status `local-ci/mbp` (fast/full) through the GitHub API; otherwise the dispatcher posts a PR comment with the summary from its own machine.

## Part 1: what you do manually

Each step needs you (a password, a GitHub web page, or a decision). Do them in order; steps marked optional can wait.

1. **Confirm the MBP stays on and awake.** It already runs a `caffeinate -s` launchd agent, so nothing is needed. Do not stop `com.local.ssh-awake`. Optional: System Settings, Battery, enable "Prevent automatic sleeping when the display is off" and keep it plugged in.
2. **Create a GitHub token for status reporting (optional but recommended).** GitHub, Settings, Developer settings, Fine-grained tokens, new token. Resource owner `tmwkdev`, repository `tmwk-app` only, permissions: Commit statuses **read and write**, Contents **read**, Metadata read. Expiry 90 days. Without it, results still work through the exit code and a PR comment posted by whoever dispatched the run.
3. **Put the token on the MBP**, typed locally rather than pasted into a chat:
   ```
   ssh mbp
   mkdir -p ~/ci && umask 077 && read -rs T && printf '%s' "$T" > ~/ci/.gh-token && unset T
   ```
4. **Decide the GitHub key's scope.** In `https://github.com/settings/keys`, check whether the MBP's `ed25519` key is a general key (can push) or add a **read-only deploy key** on `tmwkdev/tmwk-app` and use it for CI only. Recommended: a read-only deploy key, so CI cannot push.
5. **Install bun (optional now, only if the triage shows tests need it).** Some repo scripts use `bun`. On the MBP: `curl -fsSL https://bun.sh/install | bash` (user-space, no sudo). I can do this for you if you say go.
6. **Install `gh` (optional).** Only needed for the poller phase. `brew` is absent, so download the macOS amd64 zip from the `cli/cli` releases into `~/ci/bin`, or ask me to.
7. **Approve the agent doing the setup.** Tell your Orca coordinator "go" for each of: creating `~/ci/` directories and scripts, enabling the corepack pnpm shim permanently, adding an nvm loader to `~/.zshenv`, and (later) installing a launchd poller. I will not do these without that approval.
8. **Optional: require the status in GitHub.** Since Actions is off, nothing else produces a check. Repo Settings, Rules, Rulesets, new branch ruleset on `main`, "Require status checks to pass", add `local-ci/mbp`. Do this only after a few green runs, or you will block yourself.
9. **Decide what to do with the leftovers from the timing run** in `~/ci` (3.5 GiB: clone, `node_modules`, `unit-run.log`, `clean.log`). Default: they get reused as the seed, then pruned.

## Part 2: what runs automatically after Part 1

Phased so each phase is useful on its own.

**Phase 1: manual trigger, fast tier (about a day of work).**

- Add `scripts/local-ci/run.sh` and a short README in tmwk-owned paths.
- Install the pnpm shim and nvm loader so non-interactive `ssh mbp` works.
- Time the fast tier on the MBP and record it here.
- Triage the 17 failing test files from the timing run: fix an environment cause (for example a missing tool), or list them in a checked-in known-failures file so `full` can pass.
- Result: `ssh mbp ~/ci/bin/run-ci <sha> fast` returns pass/fail with logs.

**Phase 2: statuses and full tier.**

- Post `local-ci/mbp` commit statuses using the token from step 2.
- Add the `full` tier (about 46 min) and a lock so a second request queues instead of overlapping.
- Optional ruleset from step 8.

**Phase 3: automatic triggering.**

- A launchd poller (every few minutes) runs `fast` on new head SHAs of open non-draft PRs and `full` nightly on `main`. Needs `gh` or the token plus `curl`. Drafts run only on an explicit trigger or label.
- Disk and log pruning, plus a note to the owner when the MBP is unreachable.

**Phase 4: build tier**, then revisit e2e, Linux and Windows when you want them.

### Guardrails for running on a machine you also use

- All runs are niced and capped at 2 vitest workers; one run at a time.
- Runs never touch your logged-in desktop. No Electron windows in v1.
- Nothing runs from untrusted PRs: the poller only builds SHAs on `tmwkdev/tmwk-app` branches, because CI executes repo code with your user's permissions and the token file.

## What was changed on the MBP

Per the owner's request to time a full unit run, and nothing else: created `~/ci/` (clone at `~/ci/tmwk-app`, `unit-run.sh`, logs, `~/ci/bin` corepack shims) and pnpm downloads into corepack's cache (pnpm 12.14.0 for the repo, and 12.21.0 once from running `pnpm -v` outside the repo). No global installs, settings, services or sudo.

## Open questions (still unanswered)

1. Which gate is required to merge in v1: the fast tier only, or fast plus a green `full` run? (A 46 minute full run suggests: fast on every PR, full nightly and before releases.)
2. Should the MBP post statuses itself with a token (step 2), or stay credential-free and report via the dispatcher?
3. Draft PRs: run on every push, or only on an explicit trigger or label?
4. When CI and your own work compete for the 4 cores, is niced-and-capped acceptable, or should full runs only happen at night?

The homelab question from the earlier draft is dropped for now.
