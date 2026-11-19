# tmwk

<p>
  <a href="https://github.com/tmwkdev/tmwk-app"><img src="https://img.shields.io/github/stars/tmwkdev/tmwk-app?style=flat&amp;label=%E2%98%85&amp;color=08C" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="License: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="Supported platforms: macOS, Windows, and Linux" />
</p>

**One conversation to direct all your coding agents.**

tmwk is a software development control plane. You talk to one main chat, a technical partner that answers questions itself and delegates bodies of work to agents. Each delegated ticket gets an owner: Claude Code, Codex or another coding agent, running in its own worktree on your laptop or on another machine you have connected. The main chat keeps the overview, so you can direct more work without managing every agent yourself.

tmwk is a personal tool, built for one person's own infrastructure. It is a hard fork of [Orca](https://github.com/stablyai/orca), which supplies the agent adapters, native chat, orchestration, remote runtime and mobile app.

## What works today

- **The main view.** The app opens on a pinned main session on your home host, with the partner prompt and its answer-or-delegate rules.
- **Tickets and owners.** The partner creates tickets and starts their owners through Orca's orchestration. Owner reports, questions and escalations arrive in the main chat as new turns. A panel beside the chat lists what needs you, what is running and what finished.
- **Memory.** Standing preferences, notes and history search (`orca tmwk preference`, `note`, `history`). Preferences reach every briefing and owner brief.
- **Continuity.** A working summary, rollover into a fresh session without visible loss, and one "while you were away" message when you come back.
- **Everything Orca does.** Terminals, diffs, the browser, SSH and remote hosts, and the mobile app.

A ticket-first sidebar is next. There is no installable release yet; tmwk runs from source.

## Run from source

Install Node 24, the pnpm version in `packageManager` in [`package.json`](package.json), and the Bun version in [`config/.bun-version`](config/.bun-version). `pnpm install` compiles native modules, so you also need a C++ toolchain and Python 3 (Xcode Command Line Tools on macOS, Visual Studio Build Tools on Windows, `build-essential` and Electron's libraries on Linux).

```bash
git clone https://github.com/tmwkdev/tmwk-app.git
cd tmwk-app
pnpm install
pnpm dev
```

The CLI for a source build is `orca-dev`. Terminals inside the running app already have it on their `PATH`, pointed at that instance's profile. From another shell, build it and run it through pnpm:

```bash
pnpm build:cli
pnpm exec orca-dev status
```

`pnpm dev` in a linked Git worktree uses its own profile and ports, so worktrees run side by side. See [`docs/development.md`](docs/development.md) for per-OS setup and troubleshooting, and [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for the checks to run before a PR.

## Docs

The product and design docs are in [`docs/tmwk/`](docs/tmwk/README.md): the [vision](docs/tmwk/VISION.md), how the [main chat](docs/tmwk/main-chat.md) behaves and is built on Orca, and the [fork ownership map](docs/tmwk/fork-ownership.md), which says which code is upstream's and which is tmwk's. Read the map before editing anything.

## Credit and license

Built on Orca (MIT, © Lovecast Inc.). Orca's license is kept in [resources/licenses/orca/LICENSE](resources/licenses/orca/LICENSE).

tmwk is free and open source under the [MIT License](LICENSE).
