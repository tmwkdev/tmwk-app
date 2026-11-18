import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkTicketAcceptParams,
  TmwkTicketsParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkTicket } from '../../../shared/tmwk/tmwk-tickets'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { orderTickets } from '../tickets/needs-me-order'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const TICKET_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.tickets',
    permission: 'workspace',
    params: TmwkTicketsParams,
    handler: async (params, { runtime }): Promise<{ version: number; tickets: TmwkTicket[] }> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      const { version, tickets } = await openTmwkTicketStore().list({
        needsMe: params.needsMe,
        since: params.since
      })
      return { version, tickets: orderTickets(tickets) }
    }
  }),
  defineMethod({
    name: 'tmwk.ticketAccept',
    permission: 'workspace',
    params: TmwkTicketAcceptParams,
    handler: async (params, { runtime }): Promise<{ ticket: TmwkTicket }> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      const change = await openTmwkTicketStore().accept(params.taskId)
      if (change.previous?.acceptedAt === null) {
        void requestSummaryRefresh(runtime, { reason: 'ticket' })
      }
      return { ticket: change.ticket }
    }
  })
]
