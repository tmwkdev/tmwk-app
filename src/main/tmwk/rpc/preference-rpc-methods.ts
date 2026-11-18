import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkPreferenceListParams,
  TmwkPreferenceRemoveParams,
  TmwkPreferenceSetParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import {
  renderPreferenceBriefing,
  renderPreferenceHistory
} from '../briefing/render-preference-briefing'
import { resolveTmwkProject } from '../store/repo-project-resolver'
import { openTmwkStore } from '../store/open-tmwk-store'
import { isRecordInEffect } from '../store/tmwk-record-store'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const PREFERENCE_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.preferenceSet',
    permission: 'workspace',
    params: TmwkPreferenceSetParams,
    handler: async (params, context): Promise<{ record: TmwkRecord; superseded: string[] }> => {
      requireTmwkHomeHost()
      const project = await resolveTmwkProject(
        (selector) => context.runtime.showRepo(selector),
        params.project
      )
      return await openTmwkStore().add({
        kind: 'preference',
        text: params.text.trim(),
        project,
        supersedes: params.supersedes
      })
    }
  }),
  defineMethod({
    name: 'tmwk.preferenceList',
    permission: 'workspace',
    params: TmwkPreferenceListParams,
    handler: async (
      params,
      context
    ): Promise<{ records: TmwkRecord[]; partial: boolean; text: string }> => {
      requireTmwkHomeHost()
      const project = await resolveTmwkProject(
        (selector) => context.runtime.showRepo(selector),
        params.project
      )
      const all = await openTmwkStore().list('preference')
      const inScope = all.filter(
        (record) => record.project === null || record.project.repoId === project?.repoId
      )
      const effective = inScope.filter(isRecordInEffect)
      const briefing = renderPreferenceBriefing(effective, project?.repoId ?? null)
      if (!params.history) {
        return { records: effective, partial: briefing.partial, text: briefing.text }
      }
      const history = renderPreferenceHistory(inScope)
      return {
        records: inScope,
        partial: briefing.partial,
        text: history ? `${briefing.text}\n\nHistory\n${history}` : briefing.text
      }
    }
  }),
  defineMethod({
    name: 'tmwk.preferenceRemove',
    permission: 'workspace',
    params: TmwkPreferenceRemoveParams,
    handler: async (params): Promise<{ record: TmwkRecord }> => {
      requireTmwkHomeHost()
      return { record: await openTmwkStore().retire(params.id, 'preference') }
    }
  })
]
