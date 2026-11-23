import { useId, type JSX } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogWarning } from '@/components/ui/dialog-parts'
import { Label } from '@/components/ui/label'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type { WorktreeDeleteRisk } from '../../../../shared/tmwk/worktree/worktree-delete-risks'
import type { TmwkDeleteWorktreeRiskCheck } from './use-tmwk-delete-worktree-risks'

function riskLine(risk: WorktreeDeleteRisk, t: Translate): string {
  switch (risk.kind) {
    case 'unpushed-commits':
      if (risk.count !== null && risk.branch) {
        return t(
          'tmwk.deleteWorktreeSafety.unpushedCountOnBranch',
          '{{count}} unpushed commits on {{branch}}',
          {
            count: risk.count,
            branch: risk.branch,
            defaultValue_one: '{{count}} unpushed commit on {{branch}}'
          }
        )
      }
      if (risk.count !== null) {
        return t('tmwk.deleteWorktreeSafety.unpushedCount', '{{count}} unpushed commits', {
          count: risk.count,
          defaultValue_one: '{{count}} unpushed commit'
        })
      }
      return risk.branch
        ? t('tmwk.deleteWorktreeSafety.unpushedOnBranch', 'Unpushed commits on {{branch}}', {
            branch: risk.branch
          })
        : t('tmwk.deleteWorktreeSafety.unpushed', 'Unpushed commits')
    case 'live-agents':
      if (risk.agentNames.length === 0) {
        return t('tmwk.deleteWorktreeSafety.liveAgentCount', '{{count}} live agents', {
          count: risk.count,
          defaultValue_one: 'A live agent'
        })
      }
      return t('tmwk.deleteWorktreeSafety.liveAgents', '{{count}} live agents ({{names}})', {
        count: risk.count,
        names: risk.agentNames.join(', '),
        defaultValue_one: 'A live {{names}} agent'
      })
    case 'running-terminals':
      return t(
        'tmwk.deleteWorktreeSafety.runningTerminals',
        'Running, background or suspended jobs in its terminals'
      )
    case 'unknown':
      return risk.check === 'commits'
        ? t('tmwk.deleteWorktreeSafety.uncheckedCommits', 'Unpushed commits could not be checked')
        : risk.check === 'agents'
          ? t('tmwk.deleteWorktreeSafety.uncheckedAgents', 'Live agents could not be checked')
          : t(
              'tmwk.deleteWorktreeSafety.uncheckedTerminals',
              'Running work in its terminals could not be checked'
            )
  }
}

/** Names the commits and running work a delete would lose, and holds Delete until it is accepted. */
export function TmwkDeleteWorktreeRiskNotice({
  check,
  hidden,
  disabled
}: {
  check: TmwkDeleteWorktreeRiskCheck
  hidden: boolean
  disabled: boolean
}): JSX.Element | null {
  const t = useTranslate()
  const checkboxId = useId()
  if (hidden) {
    return null
  }
  if (check.checking) {
    return (
      <p className="text-[12.5px] text-muted-foreground">
        {t('tmwk.deleteWorktreeSafety.checking', 'Checking for unpushed commits and running work…')}
      </p>
    )
  }
  if (check.entries.length === 0) {
    return null
  }
  const allUnknown = check.entries.every((entry) =>
    entry.risks.every((risk) => risk.kind === 'unknown')
  )
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DialogWarning>
        {allUnknown
          ? t(
              'tmwk.deleteWorktreeSafety.mayLose',
              'Deleting may lose work that could not be checked:'
            )
          : t('tmwk.deleteWorktreeSafety.willLose', 'Deleting will lose:')}
      </DialogWarning>
      <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] leading-normal text-status-warning-text">
        {check.entries.flatMap((entry) =>
          entry.risks.map((risk) => {
            const line = riskLine(risk, t)
            return (
              <li key={`${entry.worktree.id}:${entry.worktree.hostId ?? ''}:${line}`}>
                {check.showNames ? `${entry.worktree.displayName}: ${line}` : line}
              </li>
            )
          })
        )}
      </ul>
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={check.acknowledged}
          disabled={disabled}
          onCheckedChange={(checked) => check.setAcknowledged(checked === true)}
        />
        <Label htmlFor={checkboxId} variant="dialog">
          {t('tmwk.deleteWorktreeSafety.acknowledge', 'Delete anyway and lose this work')}
        </Label>
      </div>
    </div>
  )
}
