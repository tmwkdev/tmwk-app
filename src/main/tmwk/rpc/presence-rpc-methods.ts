import { defineMethod } from '../../runtime/rpc/core'
import { TmwkPresenceReportParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import { computeAwayDigest } from '../away/compute-away-digest'
import { readPresenceStatus, recordPresence } from '../presence/presence-tracker'
import type { PresenceStatus } from '../presence/presence-state'
import { openTmwkPresenceStore } from '../store/open-tmwk-store'
import { refreshTicketSnapshots } from '../tickets/refresh-ticket-snapshots'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const PRESENCE_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.presence.report',
    permission: 'workspace',
    params: TmwkPresenceReportParams,
    handler: async (params, { runtime }): Promise<{ state: PresenceStatus }> => {
      requireTmwkHomeHost()
      if (!params.visible) {
        return { state: await readPresenceStatus() }
      }
      return {
        state: await recordPresence(runtime, { kind: 'view-visible', at: new Date().toISOString() })
      }
    }
  }),
  defineMethod({
    name: 'tmwk.awayPreview',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }): Promise<{ text: string | null }> => {
      requireTmwkHomeHost()
      const state = await openTmwkPresenceStore().read()
      const awaySince = state?.awaySince ?? state?.lastPresentAt
      if (!state || !awaySince) {
        return { text: null }
      }
      await refreshTicketSnapshots(runtime)
      const { text } = await computeAwayDigest({ digestVersion: state.digestVersion, awaySince })
      return { text }
    }
  })
]
