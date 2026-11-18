import { hostname } from 'node:os'
import { defineMethod } from '../../runtime/rpc/core'
import { renderContextBlock } from '../briefing/render-context-block'
import { openTmwkStore, openTmwkSummaryStore } from '../store/open-tmwk-store'
import { isRecordInEffect } from '../store/tmwk-record-store'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const CONTEXT_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.context',
    permission: 'workspace',
    params: null,
    handler: async (): Promise<{ text: string; partial: boolean }> => {
      requireTmwkHomeHost()
      return renderContextBlock({
        now: new Date(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        homeHostLabel: hostname(),
        effective: (await openTmwkStore().listAll()).filter(isRecordInEffect),
        projectId: null,
        summary: await openTmwkSummaryStore().latest()
      })
    }
  })
]
