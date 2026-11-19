import { hostname } from 'node:os'
import { defineMethod } from '../../runtime/rpc/core'
import { renderContextBlock } from '../briefing/render-context-block'
import { openTmwkStore, openTmwkSummaryStore, openTmwkTicketStore } from '../store/open-tmwk-store'
import { isRecordInEffect } from '../store/tmwk-record-store'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const CONTEXT_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.context',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }): Promise<{ text: string; partial: boolean }> => {
      requireTmwkHomeHost()
      await refreshTicketSnapshots(runtime)
      return renderContextBlock({
        now: new Date(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        homeHostLabel: hostname(),
        effective: (await openTmwkStore().listAll()).filter(isRecordInEffect),
        projectId: null,
        summary: await openTmwkSummaryStore().latest(),
        tickets: (await openTmwkTicketStore().list()).tickets
      })
    }
  })
]
