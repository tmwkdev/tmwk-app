import { createHash } from 'node:crypto'
import { z } from 'zod'
import { normalizeSourceControlAiSettings } from '../../../shared/source-control/ai/settings/source-control-ai-settings'
import { normalizeSourceControlActionRecipe } from '../../../shared/source-control/ai/recipes/source-control-ai-actions'
import { LOCAL_COMMIT_MESSAGE_HOST_KEY } from '../../../shared/source-control/ai/generation/commit-message-host-key'
import { TMWK_SUMMARY_MAX_CHARS, type TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import { resolveGenerationTarget } from '../../agent-hooks/first-work/first-work-generation-target'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { runGenerationRequest } from '../../text-generation/agent-generation-request'
import { resolveCommitMessageSettings } from '../../text-generation/commit-message-text-generation'
import { spawnSourceControlAgent } from '../../text-generation/execution/source-control-agent-launch'
import { readTmwkResource } from '../main-home/main-home-resources'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { createTmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkSummaryStore, openTmwkTicketStore } from '../store/open-tmwk-store'
import { renderTicketChanges } from '../tickets/render-ticket-changes'

export type SummaryRefreshOutcome = {
  outcome: 'stored' | 'skipped' | 'failed'
  /** True when a skip means nothing newer needs summarizing, so callers need not retry. */
  unchanged?: boolean
  summary?: TmwkSummary
}

export type SummaryRefreshRequest = {
  /** Bypasses the debounce, the presence check and the backoff. */
  force?: boolean
  reason: string
}

const DEBOUNCE_MS = 60_000
const BACKOFF_CAP_MS = 10 * 60_000
const TRANSCRIPT_MAX_CHARS = 60_000
const TRANSCRIPT_ENTRIES = 100
const PROMPT_FILE = 'working-summary.md'

type RefreshState = {
  chain: Promise<unknown>
  scheduled: { promise: Promise<SummaryRefreshOutcome> } | null
  failures: number
  retryAfter: number
}

const states = new WeakMap<OrcaRuntimeService, RefreshState>()

let isUserPresent: () => boolean = () => true

/** W6 replaces the default, which treats the user as always present. */
export function setUserPresenceCheck(check: () => boolean): void {
  isUserPresent = check
}

function stateFor(runtime: OrcaRuntimeService): RefreshState {
  let state = states.get(runtime)
  if (!state) {
    state = { chain: Promise.resolve(), scheduled: null, failures: 0, retryAfter: 0 }
    states.set(runtime, state)
  }
  return state
}

const ReadResult = z.object({
  entries: z.array(
    z.object({
      kind: z.string(),
      role: z.string().optional(),
      text: z.string().optional()
    })
  )
})

export function renderTranscript(result: unknown): string {
  const lines = ReadResult.parse(result).entries.flatMap((entry) => {
    if (entry.kind === 'message' && entry.text) {
      return [`${entry.role ?? 'unknown'}: ${entry.text}`]
    }
    return entry.text && entry.kind !== 'message' ? [`${entry.kind}: ${entry.text}`] : []
  })
  const joined = lines.join('\n\n')
  return joined.length > TRANSCRIPT_MAX_CHARS ? joined.slice(-TRANSCRIPT_MAX_CHARS) : joined
}

function truncateAtLine(text: string): string {
  if (text.length <= TMWK_SUMMARY_MAX_CHARS) {
    return text
  }
  const cut = text.slice(0, TMWK_SUMMARY_MAX_CHARS)
  const boundary = cut.lastIndexOf('\n')
  return (boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()
}

async function generateSummary(
  runtime: OrcaRuntimeService,
  agent: string,
  prompt: string
): Promise<string> {
  const settings = runtime.requireStore().getSettings()
  const source = normalizeSourceControlAiSettings(
    settings.sourceControlAi,
    settings.commitMessageAi
  )
  const resolved = resolveCommitMessageSettings(
    {
      ...settings,
      sourceControlAi: {
        ...source,
        actions: {
          ...source.actions,
          conversationName: normalizeSourceControlActionRecipe({ agentId: agent })
        }
      }
    },
    LOCAL_COMMIT_MESSAGE_HOST_KEY,
    'conversationName',
    null
  )
  if (!resolved.ok) {
    throw new Error(resolved.error)
  }
  if (resolved.params.agentId !== agent) {
    throw new Error(`${agent} cannot run a one-shot text task`)
  }
  const target = await resolveGenerationTarget(resolveMainHomePaths().mainHome, agent, {
    getAgentEnvResolvers: () => runtime.getCommitMessageAgentEnvironmentResolvers()
  })
  if (!target) {
    throw new Error(`no environment for ${agent}`)
  }
  const result = await runGenerationRequest({
    params: resolved.params,
    prompt,
    target,
    operation: 'tmwk-working-summary',
    spawnAgent: spawnSourceControlAgent
  })
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.rawOutput
}

async function refreshOnce(runtime: OrcaRuntimeService): Promise<SummaryRefreshOutcome> {
  const paths = resolveMainHomePaths()
  const pin = await readMainSessionPin(paths.sessionRecord)
  if (!pin) {
    return { outcome: 'skipped' }
  }
  const store = openTmwkSummaryStore()
  const previous = await store.latest()
  const transcript = renderTranscript(
    await createTmwkRpc(runtime)('agent.read', { id: pin.sessionId, limit: TRANSCRIPT_ENTRIES })
  )
  const { version: ticketVersion, tickets } = await openTmwkTicketStore().list({
    since: previous?.ticketVersion ?? 0
  })
  const ticketChanges = renderTicketChanges(tickets)
  if (!transcript && !ticketChanges) {
    return { outcome: 'skipped', unchanged: true }
  }
  const template = await readTmwkResource(PROMPT_FILE)
  if (!template) {
    throw new Error(`resources/tmwk/${PROMPT_FILE} is missing`)
  }
  const fills: Record<string, string> = {
    previous: previous?.text ?? '(none)',
    tickets: ticketChanges || '(none)',
    transcript: transcript || '(none)'
  }
  const prompt = template.replace(
    /\{\{(previous|tickets|transcript)\}\}/g,
    (_, key: string) => fills[key]
  )
  const inputHash = createHash('sha256').update(prompt).digest('hex')
  if (previous?.inputHash === inputHash) {
    return { outcome: 'skipped', unchanged: true }
  }
  const text = truncateAtLine((await generateSummary(runtime, pin.agent, prompt)).trim())
  if (!text) {
    throw new Error('the summary came back empty')
  }
  const summary = await store.add({
    text,
    sessionId: pin.sessionId,
    agent: pin.agent,
    reason: 'refresh',
    inputHash,
    ticketVersion
  })
  return { outcome: 'stored', summary }
}

async function runRefresh(
  runtime: OrcaRuntimeService,
  request: SummaryRefreshRequest
): Promise<SummaryRefreshOutcome> {
  const state = stateFor(runtime)
  let result: SummaryRefreshOutcome
  if (!request.force && (!isUserPresent() || Date.now() < state.retryAfter)) {
    result = { outcome: 'skipped' }
  } else {
    try {
      result = await refreshOnce(runtime)
      state.failures = 0
      state.retryAfter = 0
    } catch (error) {
      console.error('[tmwk] summary refresh error:', error)
      state.failures += 1
      state.retryAfter =
        Date.now() + Math.min(DEBOUNCE_MS * 2 ** (state.failures - 1), BACKOFF_CAP_MS)
      result = { outcome: 'failed' }
    }
  }
  console.error(`[tmwk] summary refresh ${result.outcome} reason=${request.reason}`)
  return result
}

/** Runs queue per runtime. Forced requests run now; others coalesce into one run after the debounce. */
export function requestSummaryRefresh(
  runtime: OrcaRuntimeService,
  request: SummaryRefreshRequest
): Promise<SummaryRefreshOutcome> {
  const state = stateFor(runtime)
  const enqueue = (): Promise<SummaryRefreshOutcome> => {
    const run = state.chain.then(() => runRefresh(runtime, request))
    state.chain = run.catch(() => undefined)
    return run
  }
  if (request.force) {
    return enqueue()
  }
  if (state.scheduled) {
    return state.scheduled.promise
  }
  const scheduled = {
    promise: new Promise<SummaryRefreshOutcome>((resolve) => {
      setTimeout(() => {
        state.scheduled = null
        resolve(enqueue())
      }, DEBOUNCE_MS).unref?.()
    })
  }
  state.scheduled = scheduled
  return scheduled.promise
}
