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
    summary: 'Search past conversations, notes and preferences in one list',
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
      'Notes and preferences read whole. A `session:orca:` chat reads its recent history. Other agent transcripts are not available through RPC.'
    ],
    examples: ['orca tmwk history read note_9d8e7f60']
  }
]
