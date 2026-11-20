import React, { useId } from 'react'
import { Search } from 'lucide-react'
import ProjectCombobox from '@/components/new-workspace/project-selection/ProjectCombobox'
import { NewWorkspaceComposerFooter } from '@/components/new-workspace/composer/NewWorkspaceComposerFooter'
import { COMBOBOX_FIELD_SHELL } from '@/components/new-workspace/type-ahead/type-ahead-combobox-styles'
import { Textarea } from '@/components/ui/textarea'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { getScreenSubmitModifierLabel } from '@/lib/keyboard/screen-submit-shortcut'
import type { NewWorkspaceProjectOption } from '@/lib/workspace/creation/new-workspace-project-options'
import type { WorkspaceCreateErrorDisplay } from '@/lib/workspace/creation/workspace-create-error-format'
import type { NewTicketDraft } from './new-ticket-sheet-store'
import { TicketRunOnPicker } from './TicketRunOnPicker'
import type { NewTicketRunOnOption } from './use-new-ticket-targets'

const FIELD_LABEL = 'text-xs font-medium text-muted-foreground'

export type NewTicketSheetFormProps = {
  /** The dialog passes its title primitive so the heading names the dialog. */
  heading?: React.ElementType
  draft: NewTicketDraft
  onDraftChange: (patch: Partial<NewTicketDraft>) => void
  projectOptions: readonly NewWorkspaceProjectOption[]
  projectFromFilter: boolean
  runOnOptions: readonly NewTicketRunOnOption[]
  runOnDefaultOpen?: boolean
  agentField: React.ReactNode
  createMore: boolean
  onCreateMoreChange: (createMore: boolean) => void
  submitting: boolean
  error: WorkspaceCreateErrorDisplay | null
  onSubmit: () => void
}

/** New ticket: the new-workspace composer's fields with the request as the main field (D58). */
export function NewTicketSheetForm({
  heading: Heading = 'h2',
  draft,
  onDraftChange,
  projectOptions,
  projectFromFilter,
  runOnOptions,
  runOnDefaultOpen,
  agentField,
  createMore,
  onCreateMoreChange,
  submitting,
  error,
  onSubmit
}: NewTicketSheetFormProps): React.JSX.Element {
  const t = useTranslate()
  const wordsId = useId()
  const hintId = useId()
  const projectHintId = useId()
  const optional = (
    <span className="text-muted-foreground/70"> {t('tmwk.newTicket.optional', '[Optional]')}</span>
  )
  return (
    <div className="space-y-4">
      <Heading className="text-base font-semibold text-foreground">
        {t('tmwk.tickets.newTicket', 'New ticket')}
      </Heading>
      <div className="space-y-1">
        <label htmlFor={wordsId} className="text-sm font-medium text-foreground">
          {t('tmwk.newTicket.wordsLabel', 'What should get done?')}
        </label>
        <Textarea
          id={wordsId}
          data-new-ticket-words
          autoFocus
          value={draft.words}
          onChange={(event) => onDraftChange({ words: event.target.value })}
          placeholder={t(
            'tmwk.newTicket.wordsPlaceholder',
            'Describe the outcome. Paste links, errors or screenshots.'
          )}
          aria-describedby={hintId}
          className="min-h-[132px] resize-none"
        />
        <p id={hintId} className="text-2xs text-muted-foreground">
          {t(
            'tmwk.newTicket.wordsHint',
            'The only required field. Opens Chat to brief and delegate this request.'
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <label className={FIELD_LABEL}>{t('tmwk.newTicket.project', 'Project')}</label>
          <ProjectCombobox
            options={projectOptions}
            value={draft.projectOptionId}
            onValueChange={(projectOptionId) =>
              onDraftChange({ projectOptionId, runOnKey: 'auto' })
            }
            placeholder={t('tmwk.newTicket.projectPlaceholder', 'No project')}
            triggerClassName="h-9 w-full border-input text-sm focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            describedBy={projectFromFilter ? projectHintId : undefined}
          />
          {projectFromFilter ? (
            <p id={projectHintId} className="text-2xs text-muted-foreground">
              {t('tmwk.newTicket.fromFilter', 'From your project filter')}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-1">
          <label className={FIELD_LABEL}>{t('tmwk.newTicket.runOn', 'Run on')}</label>
          <TicketRunOnPicker
            options={runOnOptions}
            value={draft.runOnKey}
            onChange={(runOnKey) => onDraftChange({ runOnKey })}
            defaultOpen={runOnDefaultOpen}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className={FIELD_LABEL}>
          {t('tmwk.newTicket.createFrom', 'Create from')}
          {optional}
        </label>
        <div className={cn(COMBOBOX_FIELD_SHELL, 'text-sm')}>
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={draft.source}
            onChange={(event) => onDraftChange({ source: event.target.value })}
            aria-label={t('tmwk.newTicket.createFrom', 'Create from')}
            placeholder={t(
              'tmwk.newTicket.createFromPlaceholder',
              'Paste an issue, PR or Jira URL'
            )}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className={FIELD_LABEL}>
          {t('tmwk.newTicket.agent', 'Agent')}
          {optional}
        </label>
        {agentField}
      </div>
      <NewWorkspaceComposerFooter
        createError={error}
        showCreateMultiple
        createMultiple={createMore}
        onCreateMultipleChange={onCreateMoreChange}
        onCreate={onSubmit}
        createDisabled={submitting || draft.words.trim().length === 0}
        creating={submitting}
        primaryActionLabel={t('tmwk.newTicket.create', 'Create ticket')}
        submitShortcutModifierLabel={getScreenSubmitModifierLabel()}
      />
    </div>
  )
}
