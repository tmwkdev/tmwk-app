import type { z } from 'zod'
import { defineMethod } from '../../runtime/rpc/core'
import { TmwkTicketRequestParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkTicketRequestResult } from '../../../shared/tmwk/tmwk-ticket-record'
import type { MainNotice, MainNoticeResult } from '../notices/send-main-notice'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { resolveTmwkProject, type RepoLookup } from '../store/repo-project-resolver'
import { postMainNotice, ticketRequestNotice } from '../tickets/ticket-chat-notices'
import type { TicketStore } from '../tickets/ticket-store'
import { tmwkError } from '../tmwk-error'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

type RequestDeps = {
  store: TicketStore
  lookup: RepoLookup
  post: (notice: MainNotice) => Promise<MainNoticeResult>
}

/** D58: a `requested` ticket, then its request event in Chat for the partner to brief and delegate. */
export async function requestTicket(
  params: z.output<typeof TmwkTicketRequestParams>,
  { store, lookup, post }: RequestDeps
): Promise<TmwkTicketRequestResult> {
  const existing = params.ticket ? await store.show(params.ticket) : null
  if (existing && existing.ticket.status !== 'requested') {
    throw tmwkError('ticket_started', `${existing.ticket.id} has already started.`)
  }
  const projectId = existing ? existing.ticket.projectId : undefined
  const project = await resolveTmwkProject(
    lookup,
    projectId ? `id:${projectId}` : existing ? undefined : params.project
  )
  const shown =
    existing ??
    (await store.create({
      words: params.words?.trim() ?? '',
      projectId: project?.repoId,
      runOn: params.runOn ?? 'auto',
      agent: params.agent
    }))
  const notice = ticketRequestNotice(shown.ticket, {
    ...(project ? { project } : {}),
    ...(params.runOnLabel ? { runOnLabel: params.runOnLabel } : {}),
    ...(params.source ? { source: params.source } : {})
  })
  try {
    const { via } = await post(notice)
    return { ...shown, delivery: { via } }
  } catch (error) {
    // D61: the ticket stays requested; the sheet offers Retry, which posts the notice again.
    console.error('[tmwk] ticket request notice failed:', error)
    return {
      ...shown,
      delivery: { failed: error instanceof Error ? error.message : String(error) }
    }
  }
}

export const TICKET_REQUEST_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.ticketRequest',
    permission: 'workspace',
    params: TmwkTicketRequestParams,
    handler: async (params, { runtime }): Promise<TmwkTicketRequestResult> => {
      requireTmwkHomeHost()
      return requestTicket(params, {
        store: openTmwkTicketStore(),
        lookup: (selector) => runtime.showRepo(selector),
        post: (notice) => postMainNotice(runtime, notice)
      })
    }
  })
]
