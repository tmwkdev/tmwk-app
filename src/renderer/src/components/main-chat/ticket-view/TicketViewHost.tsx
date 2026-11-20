import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { activateWorktreeFromSidebar } from '@/lib/workspace/activation/sidebar-worktree-activation'
import type { TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import { targetForKey, useMainChatHost } from '../use-main-chat-host'
import { openTicketSession } from '../tickets/open-ticket-session'
import { useTicketSidebarStore } from '../tickets/ticket-sidebar-store'
import { callTicketMutation } from '../tickets/use-ticket-overview'
import { TicketView } from './TicketView'
import { useTicketView } from './use-ticket-view'

function hasOpenAttempt(view: TmwkTicketView): boolean {
  return view.ticket.attempts.some(
    (attempt) =>
      attempt.dispatchId !== undefined &&
      attempt.settledAt === undefined &&
      attempt.outcome === undefined
  )
}

/** The owner's worktree, where Orca shows every pane of the ticket (Watch all). */
function ownerWorktreeId(view: TmwkTicketView): string | null {
  const sessions = view.row.sessions
  return (
    sessions.find((session) => session.role === 'Owner' && session.worktreeId)?.worktreeId ??
    sessions.find((session) => session.worktreeId)?.worktreeId ??
    null
  )
}

function TicketViewStatus({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-background px-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** The open ticket (D65), read from the home host; mutations refetch it and the sidebar. */
export function TicketViewHost({ ticketId }: { ticketId: string }): React.JSX.Element {
  const t = useTranslate()
  const { targetKey } = useMainChatHost()
  const { view, error } = useTicketView(targetKey, ticketId)
  const setOpenTicketId = useTicketSidebarStore((s) => s.setOpenTicketId)
  const [busy, setBusy] = useState(false)
  const backToChat = (): void => setOpenTicketId(null)
  if (!view) {
    return (
      <TicketViewStatus>
        {error ? (
          <>
            <span>{t('tmwk.ticketView.loadFailed', "Couldn't load this ticket")}</span>
            <Button size="sm" variant="ghost" onClick={backToChat}>
              {t('tmwk.ticketView.backToChat', 'Back to Chat')}
            </Button>
          </>
        ) : (
          t('tmwk.ticketView.loading', 'Loading ticket…')
        )}
      </TicketViewStatus>
    )
  }
  const mutate = (method: `tmwk.ticket${string}`, params: unknown, failure: string): void => {
    if (!targetKey) {
      return
    }
    setBusy(true)
    callTicketMutation(targetForKey(targetKey), method, params)
      .catch((cause: unknown) => {
        toast.error(failure, { description: cause instanceof Error ? cause.message : undefined })
      })
      .finally(() => setBusy(false))
  }
  const worktreeId = ownerWorktreeId(view)
  return (
    <TicketView
      view={view}
      actions={{
        busy,
        onAccept:
          view.row.state === 'result'
            ? () =>
                mutate(
                  'tmwk.ticketAccept',
                  { taskId: view.ticket.id },
                  t('tmwk.ticketView.acceptFailed', "Couldn't accept the ticket")
                )
            : undefined,
        onStop: hasOpenAttempt(view)
          ? () =>
              mutate(
                'tmwk.ticketStop',
                { ticket: view.ticket.id },
                t('tmwk.ticketView.stopFailed', "Couldn't stop the ticket")
              )
          : undefined,
        onOpenInChat: backToChat,
        onCopyId: () => {
          void window.api.ui
            .writeClipboardText(view.ticket.id)
            .then(() => toast.success(t('tmwk.ticketView.idCopied', 'Ticket ID copied')))
        }
      }}
      onOpenSession={openTicketSession}
      onWatchAll={worktreeId ? () => void activateWorktreeFromSidebar(worktreeId) : undefined}
    />
  )
}
