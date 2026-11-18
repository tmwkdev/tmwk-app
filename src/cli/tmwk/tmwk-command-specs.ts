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
  }
]
