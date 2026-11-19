# Round 3 critique brief: New ticket, Ticket options, Status order

You are the same blunt critic as rounds 1 and 2. Do not edit any file except the output file named below.

Read first: `docs/tmwk/VISION.md`, your round-2 critique at `docs/tmwk/m4-design-spike/critique/round-2-codex.md`, the recommendation in `docs/tmwk/m4-design-spike/README.md` (Finalist 1 · Attention list, Chat in the bottom dock), and the standing preference: **"the power of Orca and the simplicity of grokbot/dots."** Craft bar: `docs/STYLEGUIDE.md`, the real Create worktree composer (`src/renderer/src/components/new-workspace/composer/`) and Workspace options menu (`src/renderer/src/components/sidebar/worktree-list/controls/workspace-options-menu-items.tsx`).

## What the user approved

The user read the round-2 result and asked for three follow-ups:

1. **New ticket.** The sidebar's + means New ticket. A sheet modeled on today's Create worktree modal: the main field is a large "What should get done?" description (the only required field); Project prefilled from the filter; Run on defaults to Auto (or Local Mac / mbp); Agent optional, defaulting to the user's default; Create from (branch, GitHub issue/PR, Jira URL) stays as optional context; naming the branch/worktree is dropped (the owner picks); Create more stays; Save as draft is optional. **Decided by the user:** submitting opens Chat, and the request lands as an event-style item, not a normal user message. The partner picks it up to brief and delegate, or asks a clarifying question.
2. **Ticket options** replace Workspace options: Show (Hosts, Projects) stays as filters; Group by Attention (default) / Status / Project / Host / None; Sort within a group; Row density; Show on rows; Filters hide done / ongoing / quiet, with the worktree-only filters moved to the worktree view.
3. **Custom status order.** With Group by Status, the user drags sections into their own order (e.g. Done, then Blocked, then the rest), saved per user. Guardrail: a Needs you count stays pinned at the top whatever the order, and decisions still surface in Chat.

## Images (dark and light for each, under `docs/tmwk/m4-design-spike/images/`)

- `new-ticket-sheet-*`: the sheet over the app, + highlighted, filled in, project prefilled from the filter.
- `new-ticket-compare-*`: today's New worktree beside the empty New ticket with Run on open.
- `new-ticket-chat-*`: the request as an event in Chat, the partner's acknowledgement, a "Delegated" line, and the ticket in Quiet ("Owner starting · just now").
- `new-ticket-clarify-*`: the partner asks a clarifying question with answer buttons; the ticket sits in Needs you as a decision.
- `options-compare-*`: today's real Workspace options menu beside Ticket options.
- `options-submenus-*`: Sort within group and Show on rows open.
- `options-results-*`: default, Group by Project one-line with PR, Group by Host with project/agent/age; non-Attention groupings get the pinned Needs you strip.
- `status-order-*`: the Status order submenu mid-drag with the pinned, locked Needs you row, the resulting sidebar (Done, Blocked, then the rest), and the default order.

## What I want

1. For each of the three: what is wrong, what is right, and the fix, in priority order. Be specific about copy, hierarchy, and fidelity to the real composer and menu.
2. The Chat event: does it read as an event and not a message? Is the hand-off from event → acknowledgement → ticket clear? What about Save as draft and Create more: keep or cut?
3. Ticket options: is anything here power the simplicity principle says to hide? Is anything missing that the old menu had and people will miss?
4. Status order: does the guardrail hold (pinned count, decisions in Chat)? Is drag-to-reorder inside a submenu the right control, or is something simpler better?
5. Any overclaiming copy, or retired copy ("Main chat", "Across all projects") back?

Write to `docs/tmwk/m4-design-spike/critique/round-3-codex.md`, under ~800 words. Do not modify any other file.
