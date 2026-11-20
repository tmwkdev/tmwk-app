import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useTranslate } from '@/i18n/use-translate'
import { isScreenSubmitShortcut } from '@/lib/keyboard/screen-submit-shortcut'
import type { WorkspaceCreateErrorDisplay } from '@/lib/workspace/creation/workspace-create-error-format'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { TmwkTicketRequestResult } from '../../../../../shared/tmwk/tmwk-ticket-record'
import { useNewTicketSheetStore } from './new-ticket-sheet-store'
import { NewTicketSheetForm } from './NewTicketSheetForm'
import { TicketAgentPicker } from './TicketAgentPicker'
import { resolveNewTicketPlacement, useNewTicketTargets } from './use-new-ticket-targets'

/** Mounted in Chat; `useNewTicketSheet().open()` shows it. Posts `tmwk.ticketRequest` to the home host. */
export function NewTicketSheet({ target }: { target: RuntimeClientTarget }): React.JSX.Element {
  const t = useTranslate()
  const sheet = useNewTicketSheetStore(
    useShallow((state) => ({
      open: state.open,
      draft: state.draft,
      createMore: state.createMore,
      closeSheet: state.closeSheet,
      updateDraft: state.updateDraft,
      setCreateMore: state.setCreateMore,
      submitted: state.submitted
    }))
  )
  const targets = useNewTicketTargets()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<WorkspaceCreateErrorDisplay | null>(null)
  // D61: a ticket whose request notice failed; the next Create posts that notice again.
  const [unsent, setUnsent] = useState<string | null>(null)

  const projectOptionId =
    sheet.draft.projectOptionId ??
    targets.filterProjectOptionId ??
    (targets.projectOptions.length === 1 ? targets.projectOptions[0].id : null)
  const runOnOptions = targets.runOnOptions(projectOptionId)
  const draft = { ...sheet.draft, projectOptionId }

  const submit = async (): Promise<void> => {
    if (submitting || draft.words.trim().length === 0) {
      return
    }
    const project = targets.projectOptions.find((option) => option.id === projectOptionId)
    const placement = resolveNewTicketPlacement(project, runOnOptions, draft.runOnKey)
    const source = draft.source.trim()
    setSubmitting(true)
    setError(null)
    try {
      const result = await callRuntimeRpc<TmwkTicketRequestResult>(target, 'tmwk.ticketRequest', {
        ...(unsent
          ? { ticket: unsent }
          : {
              words: draft.words,
              ...(placement.repoId ? { project: `id:${placement.repoId}` } : {}),
              runOn: placement.runOn,
              ...(draft.agent ? { agent: draft.agent } : {})
            }),
        ...(placement.runOnLabel ? { runOnLabel: placement.runOnLabel } : {}),
        ...(source ? { source } : {})
      })
      if ('failed' in result.delivery) {
        setUnsent(result.ticket.id)
        setError({
          title: t('tmwk.newTicket.notDeliveredTitle', "Saved as a ticket, but Chat didn't get it"),
          message: result.delivery.failed,
          help: t('tmwk.newTicket.notDeliveredHelp', 'Create sends it to Chat again.')
        })
        return
      }
      setUnsent(null)
      sheet.submitted()
    } catch (failure) {
      setError({
        title: t('tmwk.newTicket.failedTitle', "Couldn't create the ticket"),
        message: failure instanceof Error ? failure.message : String(failure)
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={sheet.open} onOpenChange={(open) => !open && sheet.closeSheet()}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
        onKeyDownCapture={(event) => {
          if (isScreenSubmitShortcut(event)) {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <DialogDescription className="sr-only">
          {t(
            'tmwk.newTicket.wordsHint',
            'The only required field. Opens Chat to brief and delegate this request.'
          )}
        </DialogDescription>
        <NewTicketSheetForm
          heading={DialogTitle}
          draft={draft}
          onDraftChange={(patch) => {
            if (patch.words !== undefined) {
              setUnsent(null)
            }
            sheet.updateDraft(patch)
          }}
          projectOptions={targets.projectOptions}
          projectFromFilter={
            projectOptionId !== null && projectOptionId === targets.filterProjectOptionId
          }
          runOnOptions={runOnOptions}
          agentField={
            <TicketAgentPicker
              agent={draft.agent}
              onChange={(agent) => sheet.updateDraft({ agent })}
            />
          }
          createMore={sheet.createMore}
          onCreateMoreChange={sheet.setCreateMore}
          submitting={submitting}
          error={error}
          onSubmit={() => void submit()}
        />
      </DialogContent>
    </Dialog>
  )
}
