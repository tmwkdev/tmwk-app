import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkTicketAcceptParams,
  TmwkTicketAskParams,
  TmwkTicketAttachParams,
  TmwkTicketCreateParams,
  TmwkTicketShowParams,
  TmwkTicketsParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { resolveTmwkProject } from '../store/repo-project-resolver'
import { orderTickets } from '../tickets/needs-me-order'
import { requestSummaryRefresh } from '../summary/refresh-working-summary'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import type { TicketShow } from '../tickets/ticket-store'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const TICKET_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.tickets',
    permission: 'workspace',
    params: TmwkTicketsParams,
    handler: async (
      params,
      { runtime }
    ): Promise<{ version: number; tickets: TmwkTicketListing[] }> => {
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
    handler: async (params, { runtime }): Promise<{ ticket: TmwkTicketListing }> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      const change = await openTmwkTicketStore().accept(params.taskId)
      if (change.previous?.acceptedAt === null) {
        void requestSummaryRefresh(runtime, { reason: 'ticket' })
      }
      return { ticket: change.ticket }
    }
  }),
  defineMethod({
    name: 'tmwk.ticketCreate',
    permission: 'workspace',
    params: TmwkTicketCreateParams,
    handler: async (params, { runtime }): Promise<TicketShow> => {
      requireTmwkHomeHost()
      const project = await resolveTmwkProject(
        (selector) => runtime.showRepo(selector),
        params.project
      )
      return openTmwkTicketStore().create(
        {
          words: params.words ?? '',
          title: params.title,
          goal: params.goal,
          projectId: project?.repoId,
          kind: params.kind,
          runOn: params.runOn,
          agent: params.agent
        },
        { reuse: params.ticket }
      )
    }
  }),
  defineMethod({
    name: 'tmwk.ticketAttach',
    permission: 'workspace',
    params: TmwkTicketAttachParams,
    handler: async ({ ticket, ...attempt }, { runtime }): Promise<TicketShow> => {
      requireTmwkHomeHost()
      const attached = await openTmwkTicketStore().attach(ticket, attempt)
      if (attempt.failedStart) {
        void requestSummaryRefresh(runtime, { reason: 'ticket' })
        return attached
      }
      // The first observation of the new Task, so the listing shows it running.
      await refreshTicketSnapshots(runtime)
      return openTmwkTicketStore().show(attached.ticket.id)
    }
  }),
  defineMethod({
    name: 'tmwk.ticketShow',
    permission: 'workspace',
    params: TmwkTicketShowParams,
    handler: async (params, { runtime }): Promise<TicketShow> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      return openTmwkTicketStore().show(params.ticket)
    }
  }),
  defineMethod({
    name: 'tmwk.ticketAsk',
    permission: 'workspace',
    params: TmwkTicketAskParams,
    handler: async (params, { runtime }): Promise<TicketShow> => {
      requireTmwkHomeHost()
      const asked = await openTmwkTicketStore().ask(params.ticket, {
        text: params.question,
        recommend: params.recommend
      })
      void requestSummaryRefresh(runtime, { reason: 'ticket' })
      return asked
    }
  })
]
