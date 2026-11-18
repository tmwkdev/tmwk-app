import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'

export const TMWK_COMMAND_SPECS: CommandSpec[] = [
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
  }
]
