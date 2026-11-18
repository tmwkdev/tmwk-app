import { defineMethod } from '../../runtime/rpc/core'
import { TmwkBriefParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import { ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES } from '../../../shared/orchestration/workers/orchestration-worker-start-prompt-budget'
import { renderOwnerBrief, type OwnerBriefEvidence } from '../briefing/render-owner-brief'
import { readHistorySource } from '../history/read-history-source'
import { openTmwkStore } from '../store/open-tmwk-store'
import { resolveTmwkProject } from '../store/repo-project-resolver'
import { isRecordInEffect } from '../store/tmwk-record-store'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'
import { historySourceReaders } from './history-rpc-methods'

export const BRIEF_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.brief',
    permission: 'workspace',
    params: TmwkBriefParams,
    handler: async (
      params,
      context
    ): Promise<{ briefId: string; text: string; partial: boolean }> => {
      requireTmwkHomeHost()
      const project = await resolveTmwkProject(
        (selector) => context.runtime.showRepo(selector),
        params.project
      )
      const readers = historySourceReaders(context)
      const evidence: OwnerBriefEvidence[] = []
      for (const sourceId of params.evidence ?? []) {
        const source = await readHistorySource(sourceId, readers)
        evidence.push({ sourceId, text: source.body })
      }
      const effective = (await openTmwkStore().listAll()).filter(isRecordInEffect)
      const brief = renderOwnerBrief({
        goal: params.goal,
        words: params.words,
        effective,
        projectId: project?.repoId ?? null,
        evidence,
        maxBytes: ORCHESTRATION_WORKER_START_TASK_SPEC_MAX_BYTES
      })
      return { briefId: `brief_${Date.now().toString(36)}`, ...brief }
    }
  })
]
