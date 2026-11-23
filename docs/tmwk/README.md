# tmwk

tmwk is a hard fork of [Orca](https://github.com/stablyai/orca). Orca supplies the agent
adapters, native chat, orchestration, remote runtime and mobile app. tmwk adds the product on
top: **one main chat** that answers questions, delegates tickets to owner agents, and keeps the
overview across every ticket and host.

| Doc                                                                | Read it for                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [fork-ownership.md](fork-ownership.md)                             | tmwk is responsible for the whole app; the strategy (Follow, Maintain, Independent) for each path. **Read before editing anything.** |
| [VISION.md](VISION.md)                                             | The product: what it should feel like, and why.                                                                                      |
| [main-chat.md](main-chat.md)                                       | How the main chat behaves and how it is built on Orca. Milestones.                                                                   |
| [m1-implementation-guide.md](m1-implementation-guide.md)           | How to build M1: main home, main view, fence. Agent-neutral prompt.                                                                  |
| [m2-implementation-guide.md](m2-implementation-guide.md)           | How to build M2: tmwk store, preferences, notes, history, owner briefs.                                                              |
| [m3-implementation-guide.md](m3-implementation-guide.md)           | How to build M3: summary, rollover, away message, tickets.                                                                           |
| [m4-implementation-guide.md](m4-implementation-guide.md)           | How to build M4: ticket-first sidebar, ticket view, New ticket, options.                                                             |
| [orchestration-ownership-plan.md](orchestration-ownership-plan.md) | Plan: tmwk owns the work layer on Orca's agent primitives (path and import restrictions superseded).                                 |
| [ticket-history-plan.md](ticket-history-plan.md)                   | Plan: ticket history, stats, and Linear/Jira/GitHub links.                                                                           |
| [brand-plan.md](brand-plan.md)                                     | Plan: the app says tmwk, not Orca, with identifiers left as they are.                                                                |
| [side-by-side-install-guide.md](side-by-side-install-guide.md)     | Plan: an installable tmwk that runs beside an installed Orca (P0–P5).                                                                |
| [telemetry-plan.md](telemetry-plan.md)                             | Investigation: what Orca sends, what tmwk needs, how v0 stays off.                                                                   |
| [privacy.md](privacy.md)                                           | What tmwk sends to its own PostHog, what it never sends, and how to turn it off.                                                     |
| [identity-egress-guide.md](identity-egress-guide.md)               | Plan: one tmwk seam for app identity and egress, and the upstream tripwire.                                                          |
| [local-ci-plan.md](local-ci-plan.md)                               | Plan: nightly checks and Mac releases on the MBP, with GitHub Actions off.                                                           |
| [code-quality-plan.md](code-quality-plan.md)                       | Research and plan: AI review tools, local checks, and code health.                                                                   |
| [research/agent-context.md](research/agent-context.md)             | Conversation and memory references (OpenClaw, Hermes).                                                                               |

The predecessor prototype, grenada, is a standalone app at
[tmwkdev/tmwk](https://github.com/tmwkdev/tmwk). Its runner, adapters and protocol are superseded
by Orca. Its partner prompt, memory design and behavior rules carry over, as described in
main-chat.md.
