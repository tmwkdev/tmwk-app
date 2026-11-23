import { parseExecutionHostId } from '../../shared/execution-host/execution-host'
import { parseHostFlag, resolveEnvironmentSelectorForStore } from '../hosts/execution-host-flag'
import { listSshTargets } from '../hosts/host-selector-alternatives'
import { isLocalEnvironmentSelector } from '../hosts/local-environment-selector'
import type { RuntimeClient } from '../runtime/client'
import { RuntimeClientError } from '../runtime/connection/types'
import type { TmwkTicketRecord } from '../../shared/tmwk/tmwk-ticket-record'

type Placement = { host?: string; repo?: string }

/** Commands whose --host places the owner on a paired server (worker-start --on), so the CLI must not route the whole command there. */
export function hostFlagPlacesOwner(commandPath: readonly string[]): boolean {
  return commandPath.join(' ') === 'tmwk ticket start'
}

function routedToAnotherOrca(flags: Map<string, string | boolean>): boolean {
  const environment = flags.get('environment')
  if (environment !== undefined) {
    return !isLocalEnvironmentSelector(environment)
  }
  return (
    flags.has('pairing-code') ||
    Boolean(process.env.ORCA_ENVIRONMENT?.trim() || process.env.ORCA_PAIRING_CODE?.trim())
  )
}

/** The paired server `--host` names, checked before any ticket is written; worker-start `on` takes it. */
async function placementServer(
  flags: Map<string, string | boolean>,
  client: RuntimeClient
): Promise<string | undefined> {
  const host = parseHostFlag(flags)
  if (host === undefined) {
    return undefined
  }
  if (host.kind !== 'runtime' && host.kind !== 'alias') {
    throw new RuntimeClientError(
      'invalid_argument',
      `--host places the owner on a paired Orca server; ${host.id} is not one. Drop --host to start it on the home host. No ticket was changed.`
    )
  }
  const server = host.kind === 'runtime' ? host.environmentId : host.alias
  // A home reached through --environment has its own pairings, which this machine cannot read.
  if (routedToAnotherOrca(flags)) {
    return server
  }
  return await resolveEnvironmentSelectorForStore(server, () => listSshTargets(client))
}

/** A server has its own repo ids, so an owner placed there gets a new worktree's home repo by name. */
async function placedRepo(
  client: Pick<RuntimeClient, 'call'>,
  host: string | undefined,
  project: string | undefined,
  worktree: string
): Promise<string | undefined> {
  if (!project || !worktree.startsWith('new-') || !host) {
    return worktree.startsWith('new-') ? project : undefined
  }
  const { result } = await client.call<{ repo: { displayName: string } }>('repo.show', {
    repo: project
  })
  return `name:${result.repo.displayName}`
}

/** worker-start's `on` and repo for `ticket start`, resolved before the ticket is written. */
export async function startPlacement(
  flags: Map<string, string | boolean>,
  client: RuntimeClient,
  project: string | undefined,
  worktree: string
): Promise<Placement> {
  const host = await placementServer(flags, client)
  return { host, repo: await placedRepo(client, host, project, worktree) }
}

/** The same for a retry; tickets started before placement stored `runtime:<id>`. */
export async function retryPlacement(
  client: RuntimeClient,
  ticket: Pick<TmwkTicketRecord, 'runOn' | 'projectId'>,
  attemptHost: string | undefined,
  worktree: string
): Promise<Placement> {
  const stored = attemptHost ?? (ticket.runOn === 'auto' ? undefined : ticket.runOn)
  const parsed = parseExecutionHostId(stored)
  const host = parsed?.kind === 'runtime' ? parsed.environmentId : stored
  const project = ticket.projectId ? `id:${ticket.projectId}` : undefined
  return { host, repo: await placedRepo(client, host, project, worktree) }
}
