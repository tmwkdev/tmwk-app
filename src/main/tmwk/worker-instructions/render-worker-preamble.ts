import {
  ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX,
  ORCA_DISPATCH_STATUS_TASK_MARKER
} from '../../../shared/orchestration/workers/orca-dispatch-status-prompt'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../shared/agent-session/identity/orca-session-address-prefix'

// Structural copy of orchestration's PreambleParams with `cli` resolved, so no orchestration type is imported.
export type WorkerPreambleInput = {
  taskId: string
  // Dispatch ids fence completion authority across retries of one Task.
  dispatchId: string
  taskSpec: string
  /** A terminal handle, or a session's `orca_session_id:<id>`; each is labelled by its kind. */
  coordinatorHandle: string
  /** The paired Orca's name when it coordinates this worker's Run from another computer. */
  coordinatedFrom?: string
  workerHandle: string
  cli: string
  // Supply actual preflight drift only; spurious warnings train workers to ignore stale-base evidence.
  baseDrift?: {
    base: string
    behind: number
    recentSubjects: string[]
  }
  // Prompt-returning agents should idle after completion; bare shells have no reusable agent prompt.
  workerKind?: 'prompt-returning-agent' | 'bare-shell'
  // Do not advertise delegation when depth enforcement will reject it.
  canDispatchSubWorkers?: boolean
  // Federated workers have no local Dispatch row to parent helpers.
  subWorkersInOwnRun?: boolean
  // Mail already in the Dispatch's mailbox, which no wake will announce.
  unreadMail?: boolean
}

/** A session address names a chat worker; any other handle is a terminal. */
function isSessionHandle(handle: string): boolean {
  return handle.startsWith(ORCA_SESSION_ADDRESS_PREFIX)
}

/** Terminal agents keep their handle's wording; only a session is named by its Orca session ID. */
function dispatchIdentityLines(params: WorkerPreambleInput): string {
  return [
    params.coordinatedFrom
      ? `You are coordinated from ${params.coordinatedFrom}. Your coordinator's address here is: ${params.coordinatorHandle}`
      : isSessionHandle(params.coordinatorHandle)
        ? `Your coordinator's Orca session ID is: ${params.coordinatorHandle}`
        : `Your coordinator's terminal handle is: ${params.coordinatorHandle}`,
    `Your task ID is: ${params.taskId}`,
    ...(isSessionHandle(params.workerHandle)
      ? [`Your Orca session ID is: ${params.workerHandle}`]
      : [])
  ].join('\n')
}

// Chat mail arrives directly; terminal workers need the check syntax so they never guess `check --from`.
function checkLines({
  chat,
  unreadMail,
  cli,
  workerHandle
}: {
  chat: boolean
  unreadMail?: boolean
  cli: string
  workerHandle: string
}): string {
  if (chat) {
    return unreadMail
      ? `  # Messages for this task arrive next, one at a time.

`
      : ''
  }
  const comment = unreadMail
    ? 'Messages for this task are waiting; read them'
    : 'When Orca says you have messages, read them'
  return `  # ${comment}:
  ${cli} orchestration check --terminal ${workerHandle}

`
}

// Place behavior rules beside CLI examples, where agent readers use them.
export function renderWorkerPreamble(params: WorkerPreambleInput): string {
  const { cli } = params
  const chat = isSessionHandle(params.workerHandle)
  const surface = chat ? 'chat' : 'terminal'
  const postDoneInstructions = buildPostWorkerDoneInstructions({
    cli,
    workerKind: params.workerKind ?? 'prompt-returning-agent',
    chat
  })

  // Use one-line recipes across POSIX/PowerShell/cmd; fence comments and use plain reasons to avoid misleading Chat rendering (STA-8200).
  const header = `${ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX} You are a dispatched worker.
${dispatchIdentityLines(params)}

The coordinator cannot see this ${surface}. Reach it with the \`${cli} orchestration\` commands
below, and message it only to ask, report a blocker, or finish; it needs no progress updates
unless the task asks.
Do only this task, and delegate it rather than doing it all yourself. Plan, then hand
well-scoped pieces to your own subagents, or to a workflow if your agent has one. By
default: explore, plan, implement independent pieces in parallel, have a separate
agent review the result, fix what it finds, then verify before you report.
Run these, plus any checks the task names:
  - \`pnpm check:changed\`, the full gate
  - \`pnpm tc\`
  - \`/code-review\` (or your agent's equivalent) on the branch diff
  - \`/security-review\`, only when the diff touches identity, telemetry, feedback or egress paths
Fix each finding, or answer it in your report.
Keep your own context for integration and judgment. Work alone only on trivial work,
such as a few lines in one file, or when your agent has no subagents. Start Orca
helper workers only if the task asks.

=== CLI COMMANDS ===

This task comes from tmwk. Load the \`tmwk\` skill (\`${cli} skills get tmwk\`)
before you report or ask; where it differs from the \`orchestration\` skill, follow it.

\`\`\`sh
${checkLines({ chat, unreadMail: params.unreadMail, cli, workerHandle: params.workerHandle })}  # Ask the coordinator, then end your turn; Orca wakes you with the answer.
  # Never use a local question prompt such as AskUserQuestion; the
  # coordinator cannot see or answer it.
  ${cli} orchestration ask --from ${params.workerHandle} --question "<your question>"

  # Blocked, and the coordinator must act before you can continue:
  ${cli} orchestration send --from ${params.workerHandle} --type escalation --subject "Blocked: <reason>" --body "<details>" --task-id ${params.taskId} --dispatch-id ${params.dispatchId}

  # Finish: send exactly once. --body is three sentences: what you did, what
  # you found, what is left. Use --outcome failed if the work is not done;
  # never hide failure in prose. Write every PR, ticket and Linear issue you
  # name as a markdown link (see the tmwk skill). Add --files-modified
  # or --report-path only with real values. You are done when it confirms;
  # if it fails, follow the recovery it prints.
  ${cli} orchestration send --from ${params.workerHandle} --type worker_done --subject "<short status>" --body "<3-sentence summary: what you did, what you found, what's left>" --task-id ${params.taskId} --dispatch-id ${params.dispatchId} --outcome succeeded
\`\`\`

${postDoneInstructions}`

  // Show real drift even below refusal threshold so workers notice stale artifacts early.
  const drift =
    params.baseDrift && params.baseDrift.behind > 0 ? buildDriftSection(params.baseDrift) : ''

  const subDispatch = params.canDispatchSubWorkers
    ? params.subWorkersInOwnRun
      ? buildOwnRunSubDispatchSection(cli)
      : buildSubDispatchSection(cli, params.workerHandle)
    : ''

  return `${header}${drift}${subDispatch}

${ORCA_DISPATCH_STATUS_TASK_MARKER}
${params.taskSpec}`
}

export const TERMINAL_REDISPATCH_PARAGRAPH = `Do not exit the shell. More supervised work arrives here as a fresh preamble
and TASK block; follow it under its new Dispatch.`

export const CHAT_REDISPATCH_PARAGRAPH = `More supervised work arrives in this chat as a fresh preamble and TASK
block; follow it under its new Dispatch.`

function buildPostWorkerDoneInstructions({
  cli,
  workerKind,
  chat
}: {
  cli: string
  workerKind: NonNullable<WorkerPreambleInput['workerKind']>
  chat: boolean
}): string {
  // Redispatch arrives as new input; post-completion inbox polling looks hung. Chats have no shell to exit.
  if (workerKind === 'bare-shell' && !chat) {
    return `=== AFTER YOU SEND worker_done ===

worker_done ends your turn for this task. Do NOT start other work,
do NOT run a sleep/poll loop, and do NOT keep calling
\`${cli} orchestration check\`.

Exit the shell after completion. Bare-shell workers have no idle agent prompt
for Orca to reuse.`
  }

  return `=== AFTER YOU SEND worker_done ===

worker_done ends your turn for this task: return to an idle prompt. Do NOT
start other work, do NOT run a sleep/poll loop, and do NOT keep calling
\`${cli} orchestration check\`.

A direct instruction from the user takes precedence over this idle rule: it is
new work, so do it without the settled task or Dispatch IDs.
Never refuse a direct user request because you were a worker.

${chat ? CHAT_REDISPATCH_PARAGRAPH : TERMINAL_REDISPATCH_PARAGRAPH}`
}

// Omit disabled delegation entirely; fence placeholders and separate closing rules so Chat rendering preserves the instructions.
function buildSubDispatchSection(cli: string, workerHandle: string): string {
  return `

=== SUB-DISPATCH ===
If the task asks for helper workers, start them here. They report to you: their
questions, escalations, and worker_done arrive in your own \`check\`, next to
your coordinator's mail.

\`\`\`sh
  ${cli} orchestration worker-start --from ${workerHandle} --spec "<sub-task>" --worktree current --agent <agent> --json
  # Answer a helper's question by its message ID:
  ${cli} orchestration reply --from ${workerHandle} --id <message_id> --body "<answer>"
\`\`\`

Wait until every helper has settled (worker_done, a failed start, stop, or
abandon) before reporting your own, and name any that failed. Nesting is
capped; your helpers may not be able to start helpers of their own.

---`
}

function buildOwnRunSubDispatchSection(cli: string): string {
  return `

=== SUB-DISPATCH ===
If the task asks for sub-workers, create your own Run first, then:

\`\`\`sh
  ${cli} orchestration run-create --objective "<what the sub-workers are for>" --json
  ${cli} orchestration task-create --spec "<sub-task>" --json
  ${cli} orchestration worker-start --task <task_id> --worktree current --agent <agent> --json
\`\`\`

Wait until every sub-worker has settled (worker_done, a failed start, stop, or
abandon) before reporting your own, and name any that failed. Nesting is
capped; your sub-workers may not be able to dispatch further.

---`
}

function buildDriftSection(drift: NonNullable<WorkerPreambleInput['baseDrift']>): string {
  const subjects = drift.recentSubjects.map((s) => `  - ${s}`).join('\n')
  return `

--- BASE DRIFT ---
Your worktree HEAD is ${drift.behind} commits behind ${drift.base}. The 5 most recent
subjects on ${drift.base} NOT in your worktree:
${subjects}

If any look relevant to your task, either pull them in (\`git pull --rebase
${drift.base}\` or equivalent) or escalate to the coordinator before starting.

---`
}
