import type { CommandHandler, HandlerContext } from '../dispatch/dispatch'
import {
  getOptionalStringFlag,
  getRepeatedStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { readTextOrFileFlag } from '../arguments/command-body-input'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import { resolveCoordinatorTerminalHandle } from '../orchestration/identity/terminal-identity'
import type { RuntimeRpcSuccess } from '../../shared/remote-runtime/rpc/runtime-rpc-envelope'
import type {
  TmwkTicketRecord,
  TmwkTicketShow,
  TmwkTicketSource
} from '../../shared/tmwk/tmwk-ticket-record'
import { parseTicketSourceUrl } from '../../shared/tmwk/ticket-source'
import { callTmwk } from './tmwk-rpc-call'

const MAIN_RUN_OBJECTIVE = 'main'

type WorkerStartReceipt = {
  runId: string
  taskId: string
  dispatchId: string
  state: string
  failedStage?: string
  lastError?: string
  server?: { name?: string }
  effects?: unknown[]
  launch?: { requested?: LaunchSelection | null; effective?: LaunchSelection | null }
}

type LaunchSelection = { agent?: string | null; model?: string | null; effort?: string | null }

type AttemptLaunch = { agent?: string; model?: string; effort?: string }

type StartPlan = {
  ticket: TmwkTicketRecord
  runId: string
  taskId?: string
  spec?: string
  title: string
  worktree: string
  repo?: string
  agent?: string
  model?: string
  effort?: string
  host?: string
  retryOf?: string
  briefId?: string
}

type StartResult = TmwkTicketShow & { receipt?: WorkerStartReceipt }

function errorText(error: unknown): string {
  if (error instanceof RuntimeClientError) {
    return `${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

function worktreeIdOf(receipt: WorkerStartReceipt): string | undefined {
  for (const effect of receipt.effects ?? []) {
    if (
      typeof effect === 'object' &&
      effect !== null &&
      'kind' in effect &&
      effect.kind === 'worktree' &&
      'id' in effect &&
      typeof effect.id === 'string'
    ) {
      return effect.id
    }
  }
  return undefined
}

/** What the start launched: the receipt's effective selection, else the requested one, else what was asked for. */
function launchOf(receipt: WorkerStartReceipt | undefined, plan: StartPlan): AttemptLaunch {
  const pick = (field: keyof LaunchSelection) =>
    receipt?.launch?.effective?.[field] ?? receipt?.launch?.requested?.[field] ?? plan[field]
  const launch = { agent: pick('agent'), model: pick('model'), effort: pick('effort') }
  return Object.fromEntries(Object.entries(launch).filter(([, value]) => value))
}

/** The newest Run named `main`: the partner's Run, which ticket refresh reads. */
async function resolveMainRun(ctx: HandlerContext): Promise<string> {
  const explicit = getOptionalStringFlag(ctx.flags, 'run')
  if (explicit) {
    return explicit
  }
  const { result } = await ctx.client.call<{
    runs: { id: string; objective: string; updated_at?: string }[]
  }>('orchestration.runList', {})
  const main = result.runs
    .filter((run) => run.objective.trim().toLowerCase() === MAIN_RUN_OBJECTIVE)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0]
  if (!main) {
    throw new RuntimeClientError(
      'tmwk_no_main_run',
      'There is no Run named main. Create it with `orca orchestration run-create --objective "main"`, then run this again. No ticket was changed.'
    )
  }
  return main.id
}

/** Creates the Task (unless retrying one), starts its owner, and records the attempt either way (G6). */
async function startAttempt(ctx: HandlerContext, plan: StartPlan): Promise<StartResult> {
  const { flags, client, cwd } = ctx
  const attach = (attempt: Record<string, unknown>) =>
    callTmwk<TmwkTicketShow>(client, 'tmwk.ticketAttach', {
      ticket: plan.ticket.id,
      runId: plan.runId,
      ...launchOf(undefined, plan),
      ...(plan.host ? { host: plan.host } : {}),
      ...(plan.retryOf ? { retryOf: plan.retryOf } : {}),
      ...(plan.briefId ? { briefId: plan.briefId } : {}),
      ...attempt
    })
  const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
  let taskId = plan.taskId
  if (taskId === undefined) {
    try {
      const created = await client.call<{ task: { id: string } }>('orchestration.taskCreate', {
        spec: plan.spec,
        taskTitle: plan.title,
        run: plan.runId,
        callerTerminalHandle: from
      })
      taskId = created.result.task.id
    } catch (error) {
      const failed = await attach({
        failedStart: true,
        failedStage: 'task_create',
        failureReason: errorText(error)
      })
      return failed.result
    }
  }
  let receipt: WorkerStartReceipt
  try {
    const started = await client.call<WorkerStartReceipt>('orchestration.workerStart', {
      task: taskId,
      run: plan.runId,
      from,
      worktree: plan.worktree,
      ...(plan.repo ? { repo: plan.repo } : {}),
      name: getOptionalStringFlag(flags, 'name'),
      agent: plan.agent,
      model: plan.model,
      effort: plan.effort,
      on: plan.host,
      retryOf: plan.retryOf
    })
    receipt = started.result
  } catch (error) {
    const failed = await attach({
      taskId,
      failedStart: true,
      failedStage: 'worker_start',
      failureReason: errorText(error)
    })
    return failed.result
  }
  // outcome_unknown may still be running, so the attempt stays open and refresh settles it.
  const failedStart = receipt.state !== 'ready' && receipt.state !== 'outcome_unknown'
  const attached = await attach({
    taskId: receipt.taskId,
    dispatchId: receipt.dispatchId,
    worktreeId: worktreeIdOf(receipt),
    ...launchOf(receipt, plan),
    ...(receipt.server?.name ? { host: receipt.server.name } : {}),
    ...(failedStart
      ? {
          failedStart: true,
          failedStage: receipt.failedStage ?? receipt.state,
          failureReason: receipt.lastError ?? `worker-start returned ${receipt.state}`
        }
      : {})
  })
  return { ...attached.result, receipt }
}

function parseSourceFlag(url: string | undefined): TmwkTicketSource | undefined {
  if (url === undefined) {
    return undefined
  }
  const source = parseTicketSourceUrl(url)
  if (!source) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--source must be a Linear, Jira or GitHub issue URL, not ${url}. No ticket was changed.`
    )
  }
  return source
}

function printStart(response: RuntimeRpcSuccess<StartResult>, json: boolean): void {
  const { listing } = response.result
  if (listing.failure !== null) {
    process.exitCode = 1
  }
  printResult(response, json, (result) => {
    const ticket = result.listing
    if (ticket.failure !== null) {
      return `${ticket.id} is a stop. ${ticket.failure}\nRetry with: orca tmwk ticket retry ${ticket.id}`
    }
    const unknown =
      result.receipt?.state === 'outcome_unknown'
        ? `\nThe start outcome is unknown; check it with: orca orchestration worker-show --dispatch ${ticket.dispatchId}`
        : ''
    return `Started ${ticket.id}: task ${ticket.taskId}, dispatch ${ticket.dispatchId}, on ${ticket.host ?? 'the home host'}.${unknown}`
  })
}

function withResult(
  response: RuntimeRpcSuccess<unknown>,
  result: StartResult
): RuntimeRpcSuccess<StartResult> {
  return { ...response, result }
}

export const TMWK_TICKET_START_HANDLERS: Record<string, CommandHandler> = {
  'tmwk ticket start': async (ctx) => {
    const { flags, client, cwd, json } = ctx
    const reuse = getOptionalStringFlag(flags, 'ticket')
    const goal = await readTextOrFileFlag(flags, cwd, 'goal', true)
    const project = getOptionalStringFlag(flags, 'project')
    const agent = getOptionalStringFlag(flags, 'agent')
    const host = getOptionalStringFlag(flags, 'host')
    const title = getOptionalStringFlag(flags, 'title')
    const source = parseSourceFlag(getOptionalStringFlag(flags, 'source'))
    const evidence = getRepeatedStringFlag(flags, 'evidence')
    const runId = await resolveMainRun(ctx)
    const existing = reuse
      ? (await callTmwk<TmwkTicketShow>(client, 'tmwk.ticketShow', { ticket: reuse })).result.ticket
      : undefined
    const words = getOptionalStringFlag(flags, 'words') ?? existing?.words
    if (!words) {
      throw new RuntimeClientError(
        'invalid_argument',
        "Missing --words: the user's request verbatim."
      )
    }
    // Brief first: a refused brief leaves no new ticket behind.
    const brief = await callTmwk<{ briefId: string; text: string }>(client, 'tmwk.brief', {
      goal,
      words,
      ...(project ? { project } : {}),
      ...(evidence.length === 0 ? {} : { evidence })
    })
    const created = await callTmwk<TmwkTicketShow>(client, 'tmwk.ticketCreate', {
      ...(reuse ? { ticket: reuse } : {}),
      words,
      goal,
      ...(title ? { title } : {}),
      ...(project ? { project } : {}),
      ...(agent ? { agent } : {}),
      ...(source ? { source } : {}),
      ...(host ? { runOn: host } : {}),
      ...(flags.get('ongoing') === true ? { kind: 'ongoing' } : {})
    })
    const worktree = getOptionalStringFlag(flags, 'worktree') ?? 'new-top-level'
    const result = await startAttempt(ctx, {
      ticket: created.result.ticket,
      runId,
      spec: brief.result.text,
      title: created.result.ticket.title,
      worktree,
      repo: worktree.startsWith('new-') ? project : undefined,
      agent: agent ?? created.result.ticket.agent,
      model: getOptionalStringFlag(flags, 'model'),
      effort: getOptionalStringFlag(flags, 'effort'),
      host,
      briefId: brief.result.briefId
    })
    printStart(withResult(created, result), json)
  },

  'tmwk ticket retry': async (ctx) => {
    const { flags, client, json } = ctx
    const shown = await callTmwk<TmwkTicketShow>(client, 'tmwk.ticketShow', {
      ticket: getRequiredStringFlag(flags, 'ticket')
    })
    const { ticket } = shown.result
    const latest = ticket.attempts.at(-1)
    if (!latest?.taskId || !latest.runId) {
      throw new RuntimeClientError(
        'tmwk_nothing_to_retry',
        `${ticket.id} has no Orca task to retry. Start it with: orca tmwk ticket start --ticket ${ticket.id} --goal "<goal>"`
      )
    }
    if (latest.settledAt === undefined) {
      throw new RuntimeClientError(
        'tmwk_ticket_running',
        `${ticket.id} has a running attempt (dispatch ${latest.dispatchId ?? 'unknown'}); message its owner instead.`
      )
    }
    const project = ticket.projectId ? `id:${ticket.projectId}` : undefined
    const worktree =
      getOptionalStringFlag(flags, 'worktree') ??
      (latest.worktreeId ? `id:${latest.worktreeId}` : 'new-top-level')
    const runOn = ticket.runOn === 'auto' ? undefined : ticket.runOn
    const result = await startAttempt(ctx, {
      ticket,
      runId: latest.runId,
      taskId: latest.taskId,
      title: ticket.title,
      worktree,
      repo: worktree.startsWith('new-') ? project : undefined,
      agent: getOptionalStringFlag(flags, 'agent') ?? latest.agent ?? ticket.agent,
      model: getOptionalStringFlag(flags, 'model'),
      effort: getOptionalStringFlag(flags, 'effort'),
      host: latest.host ?? runOn,
      retryOf: latest.dispatchId
    })
    printStart(withResult(shown, result), json)
  }
}
