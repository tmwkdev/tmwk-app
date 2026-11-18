import { defineMethod, type RpcContext } from '../../runtime/rpc/core'
import {
  TmwkHistoryReadParams,
  TmwkHistorySearchParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import { AiVaultSearchRequestSchema } from '../../../shared/ai-vault/search/ai-vault-search-contract'
import { sessionSearchTransportForClient } from '../../../shared/ai-vault/search/ai-vault-search-transport'
import { searchSessionService } from '../../ai-vault-search/session-search-service-registry'
import { searchWithStructuredOwners } from '../../ai-vault/structured-sessions/structured-session-ownership'
import {
  clientOpensStructuredChatFromHistory,
  supportsStructuredAgentSessions
} from '../../runtime/rpc/methods/structured-sessions/structured-agent-session-policy'
import { resolveAgentConversation } from '../../runtime/agent-conversations/agent-conversation-address'
import { readAgentConversation } from '../../runtime/agent-conversations/agent-conversation-read'
import {
  readHistorySource,
  type HistorySourceReaders,
  type TmwkHistorySource
} from '../history/read-history-source'
import {
  HISTORY_SEARCH_DEFAULT_LIMIT,
  mergeHistoryHits,
  searchStoreRecords,
  searchSummaries,
  sessionHitToHistoryHit,
  type TmwkHistoryHit
} from '../history/search-tmwk-history'
import { openTmwkStore, openTmwkSummaryStore } from '../store/open-tmwk-store'
import { resolveTmwkProject } from '../store/repo-project-resolver'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export function historySourceReaders(context: RpcContext): HistorySourceReaders {
  return {
    records: () => openTmwkStore().listAll(),
    summaries: () => openTmwkSummaryStore().list(),
    readOrcaSession: async (id) =>
      readAgentConversation(context, await resolveAgentConversation(context.runtime, id), {
        limit: 100
      })
  }
}

export const HISTORY_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.historySearch',
    permission: 'workspace',
    params: TmwkHistorySearchParams,
    handler: async (
      params,
      context
    ): Promise<{ hits: TmwkHistoryHit[]; truncated: boolean; sessionsSearched: boolean }> => {
      requireTmwkHomeHost()
      const limit =
        params.limit === undefined || params.limit < 1 ? HISTORY_SEARCH_DEFAULT_LIMIT : params.limit
      let repoPath: string | null = null
      const project = await resolveTmwkProject(async (selector) => {
        const repo = await context.runtime.showRepo(selector)
        repoPath = repo.path
        return repo
      }, params.project)
      const filter = { query: params.query, repoId: project?.repoId ?? null, ticket: params.ticket }
      const storeHits = [
        ...searchStoreRecords(await openTmwkStore().listAll(), filter),
        ...searchSummaries(await openTmwkSummaryStore().list(), filter)
      ]

      // Session hits carry no ticket link, so a ticket filter leaves them out.
      let sessionHits: TmwkHistoryHit[] = []
      let sessionsSearched = false
      if (params.ticket === undefined) {
        try {
          const transport = sessionSearchTransportForClient(context.clientKind)
          const request = AiVaultSearchRequestSchema.parse({
            query: params.query,
            scope: 'all',
            limit,
            ...(repoPath === null ? {} : { filters: { scopePaths: [repoPath] } })
          })
          const response = await (supportsStructuredAgentSessions(context)
            ? searchWithStructuredOwners(searchSessionService(request, transport), {
                ensureHost: () => context.runtime.ensureStructuredAgentSessionHost(),
                transport,
                opensChat: (agent) => clientOpensStructuredChatFromHistory(context, agent)
              })
            : searchSessionService(request, transport))
          if (response.kind === 'results') {
            sessionsSearched = true
            sessionHits = response.hits.map(sessionHitToHistoryHit)
          }
        } catch {
          // Conversation search is best effort; store hits still answer.
        }
      }
      return { ...mergeHistoryHits(storeHits, sessionHits, limit), sessionsSearched }
    }
  }),
  defineMethod({
    name: 'tmwk.historyRead',
    permission: 'workspace',
    params: TmwkHistoryReadParams,
    handler: async (params, context): Promise<TmwkHistorySource> => {
      requireTmwkHomeHost()
      return await readHistorySource(params.sourceId, historySourceReaders(context))
    }
  })
]
