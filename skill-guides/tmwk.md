---
name: tmwk
description: >-
  How to work as the owner of a tmwk task. Use when your prompt says "This task
  comes from tmwk" or names a tmwk ticket. It covers what tmwk asks of an owner:
  how to work, report and ask. For Orca's own orchestration commands (check,
  reply, worker-start, sub-dispatch) use the `orchestration` skill.
---

# tmwk owner guide

You own a task that tmwk (the user's main chat) handed you through Orca. Your
preamble starts with "You are working inside Orca" and says "This task comes
from tmwk". Follow the preamble first, then this guide. Where either differs
from the `orchestration` skill, follow the preamble and this guide.

## Recipe

`ORCA` stands for the executable you used to run `skills get`. Type it in its
place for every command.

- **Work.** Do only the task in the `=== TASK ===` block, and coordinate it
  as below. Start Orca helper workers only if the task asks for them.
- **Ask.** When you need a decision, use the preamble's `ask` command, then
  end your turn. Orca wakes you with the answer. Never use a local question
  prompt: the person who answers cannot see it.
- **Blocked.** Use the preamble's `escalation` command when someone must act
  before you can continue.
- **Report.** Finish with the preamble's `worker_done` command, sent once. Its
  body is three sentences: what you did, what you found, what is left. Use
  `--outcome failed` when the work is not done; never hide a failure in prose.
- **Link what you name.** Every PR, ticket, issue or commit in a report, question
  or escalation is a markdown link, so the user can click it:
  - PR: its full GitHub URL, `[#74](https://github.com/<owner>/<repo>/pull/74)`.
  - tmwk ticket: `[tk_1a2b3c4d](orca://tickets/tk_1a2b3c4d)`, which opens the
    ticket view.
  - Linear issue: its Linear URL, `[TMWK-3](https://linear.app/<workspace>/issue/TMWK-3)`.
  - Commit: its GitHub URL.
  - Look a URL up (`gh pr view <n> --json url -q .url`, `ORCA linear issue <id> --json`)
    rather than guess it; if no link exists, name the item plainly.
- **After you report,** follow the preamble's `AFTER YOU SEND worker_done`
  section.

## Coordinate the work

You coordinate; your own subagents do the bulk of the work. An agent that did not
write the plan or the code reviews it with fresh eyes, which catches what you
would miss. Use your agent's subagents, or a workflow when your agent has one
(such as Claude's Workflow tool). These are not Orca helper workers: parallel
implementation within your task means your own subagents, even though the
`orchestration` skill suggests Orca workers for it.

The default pattern:

1. **Explore.** Send subagents to answer specific questions about the code.
2. **Plan.** Split the task into pieces, each with a goal, the files it may
   touch, the task's constraints, and how to check it.
3. **Implement.** Give each piece to a subagent with that brief. Run
   independent pieces in parallel.
4. **Review.** Have a separate agent review the result against the task. Your
   own read does not count as the review.
5. **Fix** what the review finds, or hand the fixes back out. Have a large fix
   reviewed again.
6. **Verify.** Run these, plus any checks the task names, or have a subagent
   run them, and read the results yourself before you report:
   - `pnpm check:changed`, the full gate
   - `pnpm tc`
   - `/code-review` (or your agent's equivalent) on the branch diff
   - `/security-review`, only when the diff touches identity, telemetry,
     feedback or egress paths

   Fix each finding, or answer it in your report.

Keep for yourself the plan, the briefs, integrating the results, the report,
and judgment calls, such as when a subagent and the reviewer disagree. Ask
subagents for conclusions, not file dumps, so your context stays clear.

Work alone only on trivial work, such as a few lines in one file or a question
you can answer by reading, or when your agent has no subagents; then say so in
your report.

## Orca's commands

This guide does not repeat Orca's commands. For `check`, `reply`,
`worker-start`, sub-dispatch, recovery and placement, load
`ORCA skills get orchestration`.
