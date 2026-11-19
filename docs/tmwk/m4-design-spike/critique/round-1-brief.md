# Round 1 critique brief: the wide set

You are a blunt design critic. Do not edit any file except the one output file named below.

## Context (read these first)

- `docs/tmwk/VISION.md`: tickets, owners, sub-agents, sessions, hosts, work history. Key lines: "The unit of attention is usually the ticket and its outcome. Sessions, worktrees, and machines are available when I want to go deeper." "Communication is single-threaded; execution is not." "Keep quiet work visible." Needs me = decision, stop, result, in that order.
- `docs/tmwk/main-chat.md`: the M4 milestone ("The sidebar is organized by ticket, with sessions beneath, as described in VISION") and "What needs me".
- The user's standing preference: **"I want the power of Orca and the simplicity of grokbot/dots. Orca is the complex part … we are bringing the simplicity to the power they provide."**
- Today's sidebar on main: utility links (Search, Tasks, Automations, Mobile), a Projects tree of worktrees, and a compact **Chat** dock above the bottom toolbar (`docs/tmwk/chat-dock-compact/images/`).
- Craft bar: `src/renderer/src/components/sidebar/workspace-actions/context-menu/WorktreeContextMenuView.tsx` and `docs/STYLEGUIDE.md`. Retired copy that must not return: "Main chat", "Across all projects".

## What to review

Images (open each; dark and light exist for every one):

- `docs/tmwk/m4-design-spike/images/wide-sheet1-dark.png` / `-light.png`: A–D side by side
- `docs/tmwk/m4-design-spike/images/wide-sheet2-dark.png` / `-light.png`: E–G side by side
- `docs/tmwk/m4-design-spike/images/wide-h-dark.png` / `-light.png`: H, tickets as a full page, not in the sidebar
- Single sidebars: `wide-a` … `wide-g` (`-dark.png`, `-light.png`)

All use the same eight seeded tickets: a decision (New settings page), a stop (Release notes, host lost), a result (Fix flaky checks, PR ready), two running, two ongoing (Keep CI green, Weekly dependency updates), one accepted. Glyphs are Orca's real status vocabulary: question icon = decision, red dot = stop, green dot = result ready, yellow spinner = running, pulse = ongoing, check = accepted.

| Direction               | Idea                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| A · Ticket tree         | VISION literally. Tickets grouped by state, every session nested beneath with agent, model and age.          |
| B · Needs-you inbox     | Only decision/stop/result get two-line rows with the reason; quiet work is one line each; done collapsed.    |
| C · Chat-rooted threads | Chat moves to the top; tickets hang off it like threads; no session rows; Projects collapsed at the bottom.  |
| D · Dense lanes         | One-line rows grouped by state, with a session-count slot and changed dot; sessions only on the open ticket. |
| E · Projects first      | Today's Projects tree with tickets where worktrees were, host icon trailing, sessions on the open ticket.    |
| F · Since you looked    | A count strip (need you / running / ongoing), then "Changed since you looked", then "Everything else".       |
| G · Rail and panel      | A rail of ticket monograms with status badges; the selected ticket's detail fills the panel.                 |
| H · Tickets page        | The sidebar stays small (a Tickets entry with a count); the overview is a board in the main area.            |

## What I want from you

Blunt critique against the vision and the simplicity principle, not politeness. For each direction: what is wrong, what is right, and whether it should survive to the finalists. Then:

1. Which 2–3 directions (or hybrids) should go forward, and what each must change.
2. Anything all of them get wrong (copy, hierarchy, state vocabulary, hosts, projects, what Chat is, 10+ tickets, empty state).
3. Anything missing from the set: a genuinely different idea I did not try.

Write your critique to `docs/tmwk/m4-design-spike/critique/round-1-codex.md` (markdown, under ~900 words). Do not modify any other file.
