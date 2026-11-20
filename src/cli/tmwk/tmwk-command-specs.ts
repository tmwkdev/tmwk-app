import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'

export const TMWK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['tmwk', 'preference', 'set'],
    summary: "Save a standing preference in the user's words",
    usage: 'orca tmwk preference set <text> [--project <selector>] [--supersedes <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'text', 'project', 'supersedes'],
    positionalArgs: ['text'],
    notes: [
      'Quote the text. Global unless --project names a repo or folder workspace.',
      '--supersedes replaces a preference that is still in effect. A preference is at most 300 characters.'
    ],
    examples: ['orca tmwk preference set "Never merge without asking me."']
  },
  {
    path: ['tmwk', 'preference', 'list'],
    summary: 'List the standing preferences tmwk applies to the partner and owners',
    usage: 'orca tmwk preference list [--project <selector>] [--history] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'project', 'history'],
    notes: [
      'Runs against the tmwk home host. Pass --environment to reach it from another machine.',
      '--project shows global preferences plus that project. --history adds replaced and removed ones.'
    ],
    examples: ['orca tmwk preference list', 'orca tmwk preference list --json']
  },
  {
    path: ['tmwk', 'preference', 'remove'],
    summary: 'Retire a standing preference; the record is kept',
    usage: 'orca tmwk preference remove <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['orca tmwk preference remove pref_7f3a9c12']
  },
  {
    path: ['tmwk', 'note', 'save'],
    summary: 'Keep a durable fact or decision, linked to its source',
    usage: 'orca tmwk note save <text> [--project <selector>] [--source <ref>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'text', 'project', 'source'],
    positionalArgs: ['text'],
    notes: [
      'Quote the text. A note is at most 1000 characters. Global unless --project names a repo or folder workspace.',
      '--source takes a sourceId from `history search` or a short reference such as a URL.'
    ],
    examples: ['orca tmwk note save "Releases ship on Tuesdays." --source session:orca:<id>']
  },
  {
    path: ['tmwk', 'history', 'search'],
    summary: 'Search past conversations, notes, preferences and summaries in one list',
    usage:
      'orca tmwk history search <query> [--project <selector>] [--ticket <taskId>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'query', 'project', 'ticket', 'limit'],
    positionalArgs: ['query'],
    notes: [
      'Each line is `<sourceId>  <kind>  <date>  <snippet>`. Replaced and removed records are marked.',
      '--ticket keeps only store records whose source references that ticket and skips conversations.',
      'For conversation search alone, with its own filters, use `orca search`.'
    ],
    examples: ['orca tmwk history search "release schedule"']
  },
  {
    path: ['tmwk', 'history', 'read'],
    summary: 'Read one history search hit in full',
    usage: 'orca tmwk history read <sourceId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'sourceId'],
    positionalArgs: ['sourceId'],
    notes: [
      'Notes, preferences and `summary:<id>` read whole. A `session:orca:` chat reads its recent history. Other agent transcripts are not available through RPC.'
    ],
    examples: ['orca tmwk history read note_9d8e7f60']
  },
  {
    path: ['tmwk', 'brief'],
    summary: 'Render the owner spec: goal, preferences and cited evidence',
    usage:
      'orca tmwk brief (--goal <text> | --goal-file <path|->) [--words <text>] [--project <selector>] [--evidence <sourceId>]... [--out <path>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'goal', 'goal-file', 'words', 'project', 'evidence', 'out'],
    repeatableFlags: ['evidence'],
    notes: [
      'Pass the output to `orca orchestration task-create --spec`, or write it with --out and use --spec-file.',
      '--out writes on this machine, relative to the current directory, and prints the path.',
      'Notes reach the owner only when cited with --evidence. Fails with tmwk_brief_too_large when the spec exceeds the worker-start limit.'
    ],
    examples: ['orca tmwk brief --goal "Fix the login redirect" --out brief.md']
  },
  {
    path: ['tmwk', 'summary', 'write'],
    summary: 'Record a working summary the user asked for',
    usage: 'orca tmwk summary write (--text <text> | --text-file <path|->) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'text', 'text-file'],
    notes: [
      'Stored as a manual summary on the main session. At most 4000 characters. Fails with tmwk_text_too_long over that.',
      '--text-file - reads stdin. The background refresh keeps the summary current on its own; use this only when the user asks.'
    ],
    examples: ['orca tmwk summary write --text "Shipping the login fix; waiting on review."']
  },
  {
    path: ['tmwk', 'summary', 'show'],
    summary: 'Show the newest working summary with its date, agent and reason',
    usage: 'orca tmwk summary show [--history] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'history'],
    notes: ['--history lists the kept summaries, newest first, without their text.'],
    examples: ['orca tmwk summary show', 'orca tmwk summary show --history']
  },
  {
    path: ['tmwk', 'context'],
    summary: 'Print the context block: date and time, home host, preferences and summary age',
    usage: 'orca tmwk context [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Run it at the start of a turn after a gap of an hour or more.'],
    examples: ['orca tmwk context']
  },
  {
    path: ['tmwk', 'tickets'],
    summary:
      'List tickets in needs-me order: decisions, stops, then finished work not yet accepted',
    usage: 'orca tmwk tickets [--needs-me] [--since <version>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'needs-me', 'since'],
    notes: [
      'Each ticket is a tmwk record; its attempts are Tasks of the main Run. Records outlive the Run, so finished tickets stay listed. A Task started by hand in the main Run is listed as its own ticket.',
      '--needs-me keeps only tickets waiting on the user. --since lists tickets changed after that version; the version prints at the end and in --json.'
    ],
    examples: ['orca tmwk tickets --needs-me', 'orca tmwk tickets --since 12 --json']
  },
  {
    path: ['tmwk', 'tickets', 'accept'],
    summary: 'Mark a finished ticket as seen so it stops needing the user',
    usage: 'orca tmwk tickets accept <ticketId|taskId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'taskId'],
    positionalArgs: ['taskId'],
    notes: [
      'Takes a ticket id, or the Task id of one of its attempts. Fails with tmwk_unknown_ticket for an id tmwk has not seen. The ticket stays in `tickets`.'
    ],
    examples: ['orca tmwk tickets accept tk_1a2b3c4d']
  },
  {
    path: ['tmwk', 'ticket', 'start'],
    summary: 'Create a ticket (or take a requested one), brief it and start its owner in Run main',
    usage:
      'orca tmwk ticket start [--ticket <id>] (--goal <text> | --goal-file <path|->) --words <text> [--project <selector>] [--agent <agent>] [--host <server>] [--title <text>] [--ongoing] [--worktree <placement>] [--name <name>] [--model <m>] [--effort <e>] [--evidence <sourceId>]... [--run <runId>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'ticket',
      'goal',
      'goal-file',
      'words',
      'project',
      'agent',
      'host',
      'title',
      'ongoing',
      'worktree',
      'name',
      'model',
      'effort',
      'evidence',
      'run'
    ],
    repeatableFlags: ['evidence'],
    notes: [
      'Runs `tmwk brief`, records the ticket, then `orchestration task-create` and `worker-start` as you, in the Run named main, and records the attempt.',
      '--worktree defaults to new-top-level with --project as its repo; use folder:<id> for a folder project. --host places the owner on a paired server (worker-start --on).',
      'A failed start keeps the ticket as a stop in `tickets --needs-me` and exits 1; do not rerun it, use `ticket retry` when the user asks.'
    ],
    examples: [
      'orca tmwk ticket start --goal "Fix the login redirect; done when /login returns to the page" --words "fix the login redirect" --project id:repo_1 --agent claude --title "Fix login redirect"'
    ]
  },
  {
    path: ['tmwk', 'ticket', 'retry'],
    summary: "Start a new attempt on a ticket's Task after its last one stopped",
    usage:
      'orca tmwk ticket retry <ticketId> [--agent <agent>] [--worktree <placement>] [--model <m>] [--effort <e>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'ticket', 'agent', 'worktree', 'name', 'model', 'effort'],
    positionalArgs: ['ticket'],
    notes: [
      'Runs worker-start --task <task> --retry-of <dispatch> on the same host, in the last worktree unless --worktree names another.',
      'Fails with tmwk_ticket_running while an attempt is open.'
    ],
    examples: ['orca tmwk ticket retry tk_1a2b3c4d']
  },
  {
    path: ['tmwk', 'ticket', 'show'],
    summary: 'Show one ticket with its question and every attempt',
    usage: 'orca tmwk ticket show <ticketId|taskId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'ticket'],
    positionalArgs: ['ticket'],
    examples: ['orca tmwk ticket show tk_1a2b3c4d']
  },
  {
    path: ['tmwk', 'ticket', 'ask'],
    summary: 'Put a question to the user on a ticket; it becomes a decision in needs-me',
    usage: 'orca tmwk ticket ask <ticketId> --question <text> [--recommend <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'ticket', 'question', 'recommend'],
    positionalArgs: ['ticket'],
    notes: [
      'Use it on a requested ticket that needs one answer before you start it. The next `ticket start --ticket` closes the question.'
    ],
    examples: [
      'orca tmwk ticket ask tk_1a2b3c4d --question "Desktop only, or mobile too?" --recommend "Desktop only"'
    ]
  },
  {
    path: ['tmwk', 'away'],
    summary: 'Preview the message the main chat would post when you return',
    usage: 'orca tmwk away --preview [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'preview'],
    notes: [
      '--preview prints what a return right now would post, or nothing when nothing changed. It posts nothing and does not advance the watermark.'
    ],
    examples: ['orca tmwk away --preview']
  },
  {
    path: ['tmwk', 'main', 'rollover'],
    summary: 'Start a fresh main chat session that carries the working summary and preferences',
    usage: 'orca tmwk main rollover [--agent <agent>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent'],
    notes: [
      'Runs when the current turn ends, so it is safe to call from your own turn. Prints `Rollover scheduled after this turn.` or `Rollover started.`.',
      'The previous chat stays in history. --agent starts the new session on another agent; fails with tmwk_rollover_busy while another switch or rollover is pending.'
    ],
    examples: ['orca tmwk main rollover', 'orca tmwk main rollover --agent codex']
  }
]
