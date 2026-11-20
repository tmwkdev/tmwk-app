import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import {
  buildNewWorkspaceProjectOptions,
  type NewWorkspaceProjectOption
} from '@/lib/workspace/creation/new-workspace-project-options'
import {
  buildProjectHostSetupOptions,
  type ReadyProjectHostSetupOption
} from '@/lib/workspace/creation/project-host-setup-options'
import { buildExecutionHostRegistry } from '../../../../../shared/execution-host/execution-host-registry'
import {
  LOCAL_EXECUTION_HOST_ID,
  parseExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../../shared/execution-host/host-setting-overrides'
import { getNewWorkspaceDialogEligibleRepos } from '../../../../../shared/new-workspace/new-workspace-dialog-repo'
import { pickerRepos } from '../../../../../shared/project/catalog/hidden-projects'

export const RUN_ON_AUTO = 'auto'

/** A Run on choice: Auto, or a host where the project is checked out. */
export type NewTicketRunOnOption =
  | { key: typeof RUN_ON_AUTO; kind: 'auto' }
  | { key: string; kind: 'host'; setup: ReadyProjectHostSetupOption }

export type NewTicketTargets = {
  projectOptions: NewWorkspaceProjectOption[]
  /** The project the filter names when it names exactly one. */
  filterProjectOptionId: string | null
  runOnOptions: (projectOptionId: string | null) => NewTicketRunOnOption[]
}

/** What the request sends for a project and Run on choice: the checkout to use, and the paired server, if any. */
export function resolveNewTicketPlacement(
  project: NewWorkspaceProjectOption | undefined,
  runOn: NewTicketRunOnOption[],
  runOnKey: string
): { repoId?: string; runOn: string; runOnLabel?: string } {
  const hosts = runOn.flatMap((option) => (option.kind === 'host' ? [option.setup] : []))
  const chosen = runOn.find((option) => option.key === runOnKey)
  const fallback =
    project?.kind === 'project' && project.checkout
      ? project.checkout.repoId
      : (hosts.find((setup) => setup.hostId === LOCAL_EXECUTION_HOST_ID) ?? hosts[0])?.repoId
  if (chosen?.kind !== 'host') {
    return { ...(fallback ? { repoId: fallback } : {}), runOn: RUN_ON_AUTO }
  }
  const host = parseExecutionHostId(chosen.setup.hostId)
  // A paired server is `ticket start --host`; a local or SSH checkout is chosen by its repo.
  return host?.kind === 'runtime'
    ? {
        ...(fallback ? { repoId: fallback } : {}),
        runOn: host.environmentId,
        runOnLabel: chosen.setup.label
      }
    : { repoId: chosen.setup.repoId, runOn: RUN_ON_AUTO, runOnLabel: chosen.setup.label }
}

/** The composer's project and host model, read from the same store slices. */
export function useNewTicketTargets(): NewTicketTargets {
  const repos = useAppStore((s) => s.repos)
  const projects = useAppStore((s) => s.projects)
  const projectHostSetups = useAppStore((s) => s.projectHostSetups)
  const settings = useAppStore((s) => s.settings)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const filterRepoIds = useAppStore((s) => s.filterRepoIds)

  const eligibleRepos = useMemo(() => getNewWorkspaceDialogEligibleRepos(repos), [repos])
  const hosts = useMemo(
    () =>
      buildExecutionHostRegistry({
        repos,
        settings,
        hostSource: 'configured-only',
        sshTargetLabels,
        sshConnectionStates,
        runtimeEnvironments,
        runtimeStatusByEnvironmentId,
        hostLabelOverrides: getHostDisplayLabelOverrides(settings)
      }),
    [
      repos,
      settings,
      sshTargetLabels,
      sshConnectionStates,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId
    ]
  )
  const projectOptions = useMemo(
    () =>
      buildNewWorkspaceProjectOptions({
        projects,
        projectHostSetups,
        eligibleRepos: pickerRepos(eligibleRepos),
        hosts
      }),
    [eligibleRepos, hosts, projectHostSetups, projects]
  )
  const filterProjectOptionId = useMemo(() => {
    const projectIds = new Set(
      projectHostSetups
        .filter((setup) => filterRepoIds.includes(setup.repoId))
        .map((setup) => setup.projectId)
    )
    const [only] = projectIds
    return projectIds.size === 1 && projectOptions.some((option) => option.id === only)
      ? only
      : null
  }, [filterRepoIds, projectHostSetups, projectOptions])

  const runOnOptions = useMemo(
    () =>
      (projectOptionId: string | null): NewTicketRunOnOption[] => {
        const project = projectOptions.find((option) => option.id === projectOptionId)
        const setups =
          project?.kind === 'project'
            ? buildProjectHostSetupOptions({
                projectId: project.projectId,
                projectHostSetups,
                eligibleRepos,
                hosts
              }).filter((option): option is ReadyProjectHostSetupOption => option.kind === 'ready')
            : []
        return [
          { key: RUN_ON_AUTO, kind: 'auto' },
          ...setups.map((setup) => ({
            key: `${setup.hostId}:${setup.id}`,
            kind: 'host' as const,
            setup
          }))
        ]
      },
    [eligibleRepos, hosts, projectHostSetups, projectOptions]
  )

  return { projectOptions, filterProjectOptionId, runOnOptions }
}
