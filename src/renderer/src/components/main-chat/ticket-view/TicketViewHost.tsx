import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketRowSession } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TmwkTicketView } from '../../../../../shared/tmwk/ticket-view'
import { targetForKey, useMainChatHost } from '../use-main-chat-host'
import { openTicketSession, openTicketWorktree } from '../tickets/open-ticket-session'
import { useTicketSidebarStore } from '../tickets/ticket-sidebar-store'
import { callTicketMutation } from '../tickets/use-ticket-overview'
import { TicketView } from './TicketView'
import { useTicketView } from './use-ticket-view'

/** An unsettled attempt with an Orca Task has an owner, even before a refresh links its dispatch. */
function hasOpenAttempt(view: TmwkTicketView): boolean {
  return view.ticket.attempts.some(
    (attempt) =>
      (attempt.dispatchId !== undefined || attempt.taskId !== undefined) &&
      attempt.settledAt === undefined &&
      attempt.outcome === undefined
  )
}

/** The session whose worktree shows every pane of the ticket (Watch all): the owner's first. */
function worktreeSession(view: TmwkTicketView): TicketRowSession | null {
  const sessions = view.row.sessions
  return (
    sessions.find((session) => session.role === 'Owner' && session.worktreeId) ??
    sessions.find((session) => session.worktreeId) ??
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
  const watched = worktreeSession(view)
  const running = hasOpenAttempt(view)
  const decision = view.decision
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
        onStop: running
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
      onAnswer={
        decision
          ? (answer) =>
              mutate(
                'tmwk.ticketAnswer',
                { ticket: view.ticket.id, answer, decision: decision.id },
                t('tmwk.ticketView.answerFailed', "Couldn't send the answer")
              )
          : undefined
      }
      onMessage={
        running
          ? (text) =>
              mutate(
                'tmwk.ticketMessage',
                { ticket: view.ticket.id, text },
                t('tmwk.ticketView.messageFailed', "Couldn't send the message")
              )
          : undefined
      }
      composerNote={
        running
          ? undefined
          : t('tmwk.ticketView.noOwnerRunning', 'No owner is working on this ticket')
      }
      onRetry={(sent, throughChat) =>
        mutate(
          sent.kind === 'answered' ? 'tmwk.ticketAnswer' : 'tmwk.ticketMessage',
          { ticket: view.ticket.id, retry: sent.eventId, throughChat },
          sent.kind === 'answered'
            ? t('tmwk.ticketView.answerFailed', "Couldn't send the answer")
            : t('tmwk.ticketView.messageFailed', "Couldn't send the message")
        )
      }
      onOpenSession={openTicketSession}
      onWatchAll={watched ? () => openTicketWorktree(watched) : undefined}
    />
  )
}
