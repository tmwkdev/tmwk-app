# tmwk

tmwk is a hard fork of [Orca](https://github.com/stablyai/orca). Orca supplies the agent
adapters, native chat, orchestration, remote runtime and mobile app. tmwk adds the product on
top: **one main chat** that answers questions, delegates tickets to owner agents, and keeps the
overview across every ticket and host.

| Doc                                                                | Read it for                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [fork-ownership.md](fork-ownership.md)                             | Which code is upstream's and which is ours. **Read before editing anything.** |
| [VISION.md](VISION.md)                                             | The product: what it should feel like, and why.                               |
| [main-chat.md](main-chat.md)                                       | How the main chat behaves and how it is built on Orca. Milestones.            |
| [m1-implementation-guide.md](m1-implementation-guide.md)           | How to build M1: main home, main view, fence. Agent-neutral prompt.           |
| [m2-implementation-guide.md](m2-implementation-guide.md)           | How to build M2: tmwk store, preferences, notes, history, owner briefs.       |
| [m3-implementation-guide.md](m3-implementation-guide.md)           | How to build M3: summary, rollover, away message, tickets.                    |
| [orchestration-ownership-plan.md](orchestration-ownership-plan.md) | Plan: tmwk owns the work layer on Orca's agent primitives.                    |
| [research/agent-context.md](research/agent-context.md)             | Conversation and memory references (OpenClaw, Hermes).                        |

The predecessor prototype, grenada, is a standalone app at
[tmwkdev/tmwk](https://github.com/tmwkdev/tmwk). Its runner, adapters and protocol are superseded
by Orca. Its partner prompt, memory design and behavior rules carry over, as described in
main-chat.md.
