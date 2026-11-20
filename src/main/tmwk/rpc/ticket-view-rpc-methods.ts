import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkTicketStopParams,
  TmwkTicketViewParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkTicketView } from '../../../shared/tmwk/ticket-view'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkTicketStore } from '../store/open-tmwk-store'
import { buildTicketRows } from '../tickets/build-ticket-rows'
import { readTicketCode } from '../tickets/read-ticket-code'
import { readTicketDecision } from '../tickets/read-ticket-decision'
import { readTicketFleet } from '../tickets/read-ticket-fleet'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { isOpenAttempt } from '../tickets/ticket-listing'
import { tmwkError } from '../tmwk-error'
import { projectNames } from './ticket-rpc-methods'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const TICKET_VIEW_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.ticketView',
    permission: 'workspace',
    params: TmwkTicketViewParams,
    handler: async (params, { runtime }): Promise<TmwkTicketView> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      const { version, ticket } = await openTmwkTicketStore().show(params.ticket)
      const rpc = createTmwkRpc(runtime)
      const [fleet, names, decision] = await Promise.all([
        readTicketFleet(rpc, [ticket]),
        projectNames(runtime, new Set(ticket.projectId ? [ticket.projectId] : [])),
        readTicketDecision(rpc, ticket).catch((error: unknown) => {
          console.error(`[tmwk] decision read failed for ${ticket.id}:`, error)
          return null
        })
      ])
      const [row] = buildTicketRows([ticket], fleet, names)
      const latest = ticket.attempts.at(-1)
      // A paired server's worktree id names a worktree on that server, not here.
      const worktreeId =
        latest?.host === undefined
          ? (latest?.worktreeId ?? row.sessions.find((s) => s.role === 'Owner')?.worktreeId)
          : undefined
      // The attempt's stored branch and PR outlive the worktree; the live read fills what it lacks.
      const live =
        row.branch !== null && row.pr !== null ? row : await readTicketCode(rpc, worktreeId ?? null)
      return {
        version,
        ticket,
        row: { ...row, branch: row.branch ?? live.branch, pr: row.pr ?? live.pr },
        decision
      }
    }
  }),
  defineMethod({
    name: 'tmwk.ticketStop',
    permission: 'workspace',
    params: TmwkTicketStopParams,
    handler: async (params, { runtime }): Promise<{ stopped: string[] }> => {
      requireTmwkHomeHost()
      const { ticket } = await openTmwkTicketStore().show(params.ticket)
      const open = ticket.attempts.filter(
        (attempt) => isOpenAttempt(attempt) && attempt.dispatchId !== undefined
      )
      if (open.length === 0) {
        throw tmwkError('ticket_not_running', `${ticket.id} has no running attempt to stop.`)
      }
      const rpc = createTmwkRpc(runtime)
      for (const attempt of open) {
        await rpc('orchestration.workerStop', { dispatch: attempt.dispatchId })
      }
      await refreshTicketSnapshots(runtime)
      return { stopped: open.flatMap((attempt) => attempt.dispatchId ?? []) }
    }
  })
]
