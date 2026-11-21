import { z } from 'zod'
import { withTimeout } from '../../../shared/concurrency/promise-timeout-fallback'
import { parseTicketSourceUrl } from '../../../shared/tmwk/ticket-source'
import { PR_STATES, type TmwkTicketSource } from '../../../shared/tmwk/tmwk-ticket-record'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import type { AttemptFacts, AttemptLaunch, FollowedAttempt, ObservedPr } from './attempt-facts'

// A slow host or review provider must not hold up the ticket list.
const LOOKUP_TIMEOUT_MS = 5000

const LinkedItem = z.object({
  provider: z.string(),
  type: z.string(),
  number: z.number(),
  title: z.string().optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  linearIdentifier: z.string().optional(),
  jiraIdentifier: z.string().optional()
})

const WorktreeShow = z.object({
  worktree: z.object({
    repoId: z.string().optional(),
    git: z.object({ branch: z.string().nullable().optional() }).optional(),
    linkedWorkItem: LinkedItem.nullable().optional(),
    linkedItems: z.array(LinkedItem).optional()
  })
})

const Selection = z
  .object({
    agent: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    effort: z.string().nullable().optional()
  })
  .nullable()
  .optional()

const WorkerShow = z.object({
  worker: z.object({
    worktreeId: z.string().nullable().optional(),
    agentTerminalHandle: z.string().nullable().optional(),
    startOptions: z
      .object({
        launch: z.object({ requested: Selection, effective: Selection }).optional()
      })
      .nullable()
      .optional()
  }),
  projection: z
    .object({
      provider: z.object({ id: z.string(), model: z.string().nullable() }).nullable().optional(),
      workspace: z.object({ id: z.string() }).nullable().optional()
    })
    .nullable()
    .optional()
})

const Review = z.object({
  number: z.number().int().positive(),
  url: z.string(),
  state: z.enum(PR_STATES),
  updatedAt: z.string().optional()
})

const ReviewReply = z.union([Review.nullable(), z.object({ review: Review.nullable() })])

export type AttemptWorktree = { repo?: string; branch?: string; source?: TmwkTicketSource }

function sourceOf(item: z.infer<typeof LinkedItem>): TmwkTicketSource | null {
  if (item.type !== 'issue' || !item.url) {
    return null
  }
  const title = item.title ? { title: item.title } : {}
  if (item.provider === 'linear' || item.provider === 'jira') {
    const key =
      (item.provider === 'linear' ? item.linearIdentifier : item.jiraIdentifier) ?? item.identifier
    return key ? { kind: item.provider, key, url: item.url, ...title } : null
  }
  if (item.provider === 'github') {
    return (
      parseTicketSourceUrl(item.url, item.title) ?? {
        kind: 'github',
        key: `#${item.number}`,
        url: item.url,
        ...title
      }
    )
  }
  return null
}

function lookup<T>(read: () => Promise<T>): Promise<T | null> {
  return withTimeout(read(), LOOKUP_TIMEOUT_MS, null)
}

/** The worktree's repo, branch and first linked issue, from `worktree.show` on this host; null when it can't be read. */
export async function readAttemptWorktree(
  rpc: TmwkRpc,
  worktreeId: string
): Promise<AttemptWorktree | null> {
  const shown = await lookup(async () =>
    WorktreeShow.parse(await rpc('worktree.show', { worktree: `id:${worktreeId}` }))
  )
  if (!shown) {
    return null
  }
  const { worktree } = shown
  const branch = (worktree.git?.branch ?? '').replace(/^refs\/heads\//, '')
  const source = [worktree.linkedWorkItem, ...(worktree.linkedItems ?? [])]
    .map((item) => (item ? sourceOf(item) : null))
    .find((found) => found !== null)
  return {
    ...(worktree.repoId ? { repo: worktree.repoId } : {}),
    ...(branch ? { branch } : {}),
    ...(source ? { source } : {})
  }
}

function launchOf(shown: z.infer<typeof WorkerShow>): AttemptLaunch | null {
  const launch = shown.worker.startOptions?.launch
  if (!launch) {
    return null
  }
  const pick = (field: keyof AttemptLaunch) =>
    launch.effective?.[field] ?? launch.requested?.[field] ?? undefined
  return { agent: pick('agent'), model: pick('model'), effort: pick('effort') }
}

function showWorker(rpc: TmwkRpc, dispatchId: string) {
  return lookup(async () =>
    WorkerShow.parse(await rpc('orchestration.workerShow', { dispatch: dispatchId }))
  )
}

/** Orca's effective launch for the dispatch, falling back to the requested one per field. */
async function readLaunch(rpc: TmwkRpc, dispatchId: string): Promise<AttemptLaunch | null> {
  const shown = await showWorker(rpc, dispatchId)
  return shown ? launchOf(shown) : null
}

/**
 * A paired server's attempt, read on that server: its launch (the live model when the projection
 * names one), agent terminal, worktree, and the worktree's repo and branch there.
 */
async function readServerAttempt(rpc: TmwkRpc, dispatchId: string): Promise<AttemptFacts> {
  const shown = await showWorker(rpc, dispatchId)
  if (!shown) {
    return {}
  }
  const launch = launchOf(shown)
  const provider = shown.projection?.provider
  const worktreeId = shown.worker.worktreeId ?? shown.projection?.workspace?.id ?? undefined
  const terminalHandle = shown.worker.agentTerminalHandle ?? undefined
  const worktree = worktreeId ? await readAttemptWorktree(rpc, worktreeId) : null
  const agent = launch?.agent ?? provider?.id
  const model = provider?.model ?? launch?.model
  return {
    ...(agent || model ? { launch: { agent, model, effort: launch?.effort } } : {}),
    ...(worktreeId ? { worktreeId } : {}),
    ...(terminalHandle ? { terminalHandle } : {}),
    ...(worktree?.repo ? { repo: worktree.repo } : {}),
    ...(worktree?.branch ? { branch: worktree.branch } : {})
  }
}

async function readPr(
  rpc: TmwkRpc,
  review: { repo?: string; branch?: string }
): Promise<ObservedPr | null> {
  if (!review.repo || !review.branch) {
    return null
  }
  const reply = await lookup(async () =>
    ReviewReply.parse(
      await rpc('hostedReview.forBranch', { repo: `id:${review.repo}`, branch: review.branch })
    )
  )
  const found = reply && 'review' in reply ? reply.review : reply
  return found ?? null
}

/**
 * Reads each followed attempt's facts; a failed or slow read gives none, so the refresh goes on.
 * `serverRpc` reaches a paired server by name; without it a server's attempts read nothing.
 */
export async function readAttemptFacts(
  rpc: TmwkRpc,
  followed: readonly FollowedAttempt[],
  serverRpc?: (server: string) => TmwkRpc
): Promise<Map<string, AttemptFacts>> {
  const entries = await Promise.all(
    followed.map(async (attempt): Promise<[string, AttemptFacts]> => {
      if (attempt.server) {
        const facts = serverRpc
          ? await readServerAttempt(serverRpc(attempt.server), attempt.dispatchId)
          : {}
        return [attempt.dispatchId, facts]
      }
      const readCode = async () => {
        const worktree = attempt.worktreeId
          ? await readAttemptWorktree(rpc, attempt.worktreeId)
          : null
        const pr = attempt.review
          ? await readPr(rpc, {
              repo: worktree?.repo ?? attempt.review.repo,
              branch: worktree?.branch ?? attempt.review.branch
            })
          : null
        return [worktree, pr] as const
      }
      const [launch, [worktree, pr]] = await Promise.all([
        attempt.launch ? readLaunch(rpc, attempt.dispatchId) : null,
        readCode()
      ])
      return [
        attempt.dispatchId,
        {
          ...(launch ? { launch } : {}),
          ...(worktree?.repo ? { repo: worktree.repo } : {}),
          ...(worktree?.branch ? { branch: worktree.branch } : {}),
          ...(pr ? { pr } : {})
        }
      ]
    })
  )
  return new Map(entries)
}
