# Round 2 critique brief: the finalists

You are the same blunt critic as round 1. Do not edit any file except the output file named below.

Read first: `docs/tmwk/VISION.md`, the M4 row of `docs/tmwk/main-chat.md`, your own round-1 critique at `docs/tmwk/m4-design-spike/critique/round-1-codex.md`, and the standing preference: **"the power of Orca and the simplicity of grokbot/dots."**

## What changed because of round 1

- Every finalist uses one row grammar: decision → stop → result pinned under **Needs you**, each with its actual reason as the second line (no separate category line, no provider logos, no ages, no model strings in rows).
- **Ongoing is a kind, not a state:** a repeat mark on the row; an ongoing ticket can need a decision (`Watch website deploys` in the busy state). A quiet ongoing ticket shows what it handled ("Fixed 2 CI failures today").
- Sessions are an explicit disclosure (chevron at the row's right, separate from selecting the row). Disclosed sessions show status, agent and role only; models live in the ticket view.
- Hosts appear in a row only when they explain a problem: a stop ("Host lost"), or an unreachable host (WifiOff mark; quiet tickets show "MBP unreachable · last report 10:42" with a neutral dot, not "stopped"). Placement and its reason live in the ticket view's rail.
- Projects are a filter ("All projects"), not a grouping. Done collapses to one row with a count. A result stays in Needs you until accepted.
- New states: busy (18 tickets, one long title), nothing needs you, MBP unreachable, empty.
- Your missing experiment became Finalist 3.

## Images (dark and light for each)

- `docs/tmwk/m4-design-spike/images/f1-states-a-*.png`, `f1-states-b-*.png`: **Finalist 1 · Attention list** (B+D). Chat stays in today's bottom dock. Typical, ticket open, busy / nothing needs you, MBP unreachable, empty.
- `f2-states-a-*.png`, `f2-states-b-*.png`: **Finalist 2 · Chat on top** (revised C). Chat is the first row; Search beneath it; a separately labeled Tickets section with the same rows; Projects collapsed at the bottom; no dock.
- `f3-typical-*.png`, `f3-busy-*.png`, `f3-quiet-*.png`: **Finalist 3 · Shelf and queue.** The sidebar is a stable shelf in creation order, never re-sorted; the Needs you queue with one-click answers sits above the Chat composer.
- `f1-ticket-open-*.png`: the recommended ticket view: the owner conversation (work history as the thread, decision card inline, "Message the owner"), with a quiet rail for Sessions (+ Watch all), Code and Where.
- `f1-chat-open-*.png`: Finalist 1 with Chat open.
- For reference: `open-page-*.png` (ticket as a page), `open-conversation-*.png`, `open-watch-*.png` (all sessions side by side, typing into any).

## What I want

1. Rank the three finalists for the M4 default, bluntly, against the vision and the simplicity principle. Say what would make you change the ranking.
2. For the winner: every remaining flaw, in priority order, with the fix.
3. Is the ticket view right? Page vs conversation vs the rail hybrid.
4. Do the states hold up (busy, unreachable, empty, nothing needs you)? What state is still missing or wrong?
5. Is anything here overclaiming in copy, or is any retired copy ("Main chat", "Across all projects") back?

Write to `docs/tmwk/m4-design-spike/critique/round-2-codex.md`, under ~800 words. Do not modify any other file.
