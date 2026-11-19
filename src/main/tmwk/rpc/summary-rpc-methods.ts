import { defineMethod } from '../../runtime/rpc/core'
import {
  TmwkSummaryShowParams,
  TmwkSummaryWriteParams
} from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import { resolveMainHomePaths } from '../main-home/main-home-paths'
import { readMainSessionPin } from '../main-session/main-session-pin'
import { openTmwkSummaryStore } from '../store/open-tmwk-store'
import { tmwkError } from '../tmwk-error'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const SUMMARY_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.summaryWrite',
    permission: 'workspace',
    params: TmwkSummaryWriteParams,
    handler: async (params): Promise<{ summary: TmwkSummary }> => {
      requireTmwkHomeHost()
      const pin = await readMainSessionPin(resolveMainHomePaths().sessionRecord)
      if (!pin) {
        throw tmwkError('no_main_session', 'there is no main session to attach the summary to')
      }
      const text = params.text.trim()
      if (!text) {
        throw tmwkError('invalid_params', 'the summary text is empty')
      }
      const summary = await openTmwkSummaryStore().add({
        text,
        sessionId: pin.sessionId,
        agent: pin.agent,
        reason: 'manual'
      })
      return { summary }
    }
  }),
  defineMethod({
    name: 'tmwk.summaryShow',
    permission: 'workspace',
    params: TmwkSummaryShowParams,
    handler: async (
      params
    ): Promise<{ summary: TmwkSummary | null } | { summaries: TmwkSummary[] }> => {
      requireTmwkHomeHost()
      const store = openTmwkSummaryStore()
      return params.history
        ? { summaries: (await store.list()).toReversed() }
        : { summary: await store.latest() }
    }
  })
]
