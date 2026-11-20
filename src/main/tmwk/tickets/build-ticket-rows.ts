import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import { compareByAttention } from '../../../shared/tmwk/ticket-overview/ticket-attention'
import type {
  TicketRowHost,
  TicketRowModel,
  TicketRowSession,
  TicketState
} from '../../../shared/tmwk/ticket-overview/ticket-row-model'
import { deriveTicketState } from '../../../shared/tmwk/ticket-overview/ticket-state'
import type { TmwkTicketListing } from '../../../shared/tmwk/tmwk-tickets'
import type { TmwkTicketAttempt, TmwkTicketRecord } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TicketFleet, TicketFleetWorker } from './read-ticket-fleet'
import { isOpenAttempt, listTicket } from './ticket-listing'

function firstLine(text: string | null): string | null {
  const line = text?.trim().split('\n')[0]
  return line ? line : null
}

/** A worker's structured report stores JSON as the Task result; its subject is the one-line reason. */
function resultLine(result: string | null): string | null {
  try {
    const report: unknown = JSON.parse(result ?? '')
    if (
      typeof report === 'object' &&
      report !== null &&
      'subject' in report &&
      typeof report.subject === 'string' &&
      report.subject.trim()
    ) {
      return report.subject.trim()
    }
  } catch {
    // Plain-text results are their own reason.
  }
  return firstLine(result)
}

function reasonOf(state: TicketState, listing: TmwkTicketListing): string | null {
  switch (state) {
    case 'decision':
      return listing.question
    case 'stop':
      return listing.failure ?? resultLine(listing.result)
    case 'result':
      return resultLine(listing.result)
    case 'running':
    case 'waiting':
    case 'paused':
    case 'done':
      return null
  }
}

function agentOf(id: string | null | undefined): TicketRowSession['agent'] {
  return isTuiAgent(id) ? id : null
}

/** A paired server's row has no projection, so its status comes from the attempt record. */
function sessionStatus(worker: TicketFleetWorker, attempt: TmwkTicketAttempt | undefined) {
  if (worker.server === null || attempt === undefined) {
    return worker.status
  }
  if (isOpenAttempt(attempt)) {
    return 'working'
  }
  return attempt.outcome === 'completed' ? 'done' : 'failed'
}

function sessionOf(
  worker: TicketFleetWorker,
  role: string,
  attempt: TmwkTicketAttempt | undefined
): TicketRowSession {
  return {
    id: worker.dispatchId,
    agent: agentOf(worker.agent ?? attempt?.agent),
    role,
    model: worker.model,
    status: sessionStatus(worker, attempt),
    worktreeId: worker.worktreeId ?? attempt?.worktreeId ?? null,
    tabId: null,
    paneKey: null,
    executionHostId: worker.executionHostId,
    terminalHandle: worker.terminalHandle
  }
}

/** The attempts whose sessions show: every open one, and the latest so a result can be reviewed in place. */
function shownAttempts(record: TmwkTicketRecord): TmwkTicketAttempt[] {
  const latest = record.attempts.at(-1)
  return record.attempts.filter((attempt) => attempt === latest || isOpenAttempt(attempt))
}

function sessionsOf(record: TmwkTicketRecord, fleet: TicketFleet | null): TicketRowSession[] {
  if (fleet === null) {
    return []
  }
  const attempts = shownAttempts(record)
  const owners = attempts.flatMap((attempt) => {
    const worker = attempt.dispatchId ? fleet.workers.get(attempt.dispatchId) : undefined
    return worker ? [sessionOf(worker, 'Owner', attempt)] : []
  })
  const ownerIds = new Set(owners.map((session) => session.id))
  const taskIds = new Set(attempts.flatMap((attempt) => attempt.taskId ?? []))
  const helpers = [...fleet.workers.values()]
    .filter(
      (worker) =>
        !ownerIds.has(worker.dispatchId) &&
        worker.parentTaskId !== null &&
        taskIds.has(worker.parentTaskId)
    )
    .map((worker) => sessionOf(worker, 'Helper', undefined))
  return [...owners, ...helpers]
}

function hostOf(
  attempt: TmwkTicketAttempt | undefined,
  fleet: TicketFleet | null
): TicketRowHost | null {
  const worker = attempt?.dispatchId ? fleet?.workers.get(attempt.dispatchId) : undefined
  if (attempt?.host !== undefined) {
    const reach = attempt.dispatchId ? fleet?.servers.get(attempt.dispatchId) : undefined
    return {
      id: worker?.server?.environmentId ?? attempt.host,
      label: worker?.server?.name ?? attempt.host,
      reachable: reach?.reachable !== false,
      lastReportAt: reach?.lastAnsweredAt ?? worker?.server?.asOf ?? null
    }
  }
  if (worker?.executionHostId) {
    return {
      id: worker.executionHostId,
      label: worker.executionHostId,
      reachable: !worker.hostUnavailable,
      lastReportAt: worker.lastActivityAt
    }
  }
  return null
}

function lastActivityOf(record: TmwkTicketRecord, fleet: TicketFleet | null): string | null {
  const seen = shownAttempts(record).flatMap((attempt) => {
    const at = attempt.dispatchId ? fleet?.workers.get(attempt.dispatchId)?.lastActivityAt : null
    return at ? [at] : []
  })
  if (seen.length > 0) {
    return seen.reduce((latest, at) => (Date.parse(at) > Date.parse(latest) ? at : latest))
  }
  const latest = record.attempts.at(-1)
  return latest?.settledAt ?? latest?.startedAt ?? null
}

/**
 * The sidebar rows (D57): each record's listing, joined to the fleet by dispatch id, in the same
 * attention order as `tmwk.tickets`. With no fleet, rows keep the records' values.
 */
export function buildTicketRows(
  records: readonly TmwkTicketRecord[],
  fleet: TicketFleet | null,
  projectNames: ReadonlyMap<string, string>
): TicketRowModel[] {
  const rows = records.map((record): TicketRowModel => {
    const listing = listTicket(record)
    const latest = record.attempts.at(-1)
    const host = hostOf(latest, fleet)
    const state = deriveTicketState(listing, { hostUnreachable: host?.reachable === false })
    return {
      id: record.id,
      title: record.title,
      projectId: record.projectId ?? null,
      projectName: record.projectId ? (projectNames.get(record.projectId) ?? null) : null,
      state,
      reason: reasonOf(state, listing),
      kind: record.kind ?? null,
      handled: null,
      host,
      sessions: sessionsOf(record, fleet),
      startedAt: record.createdAt,
      lastActivityAt: lastActivityOf(record, fleet),
      branch: null,
      pr: null,
      changedAt: record.changedAt
    }
  })
  return rows.sort(compareByAttention)
}
