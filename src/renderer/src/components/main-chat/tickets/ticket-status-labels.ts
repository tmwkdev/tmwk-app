import { useMemo } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { TicketStatus } from '../../../../../shared/tmwk/ticket-overview/ticket-status'

/** The Group by Status names, also read out before each row's title. */
export function useTicketStatusLabels(): Record<TicketStatus, string> {
  const t = useTranslate()
  return useMemo(
    () => ({
      needsDecision: t('tmwk.tickets.status.needsDecision', 'Needs decision'),
      blocked: t('tmwk.tickets.status.blocked', 'Blocked'),
      readyForReview: t('tmwk.tickets.status.readyForReview', 'Ready for review'),
      running: t('tmwk.tickets.status.running', 'Running'),
      waiting: t('tmwk.tickets.status.waiting', 'Waiting'),
      paused: t('tmwk.tickets.status.paused', 'Paused'),
      done: t('tmwk.tickets.status.done', 'Done')
    }),
    [t]
  )
}
