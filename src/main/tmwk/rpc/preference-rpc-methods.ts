import { defineMethod } from '../../runtime/rpc/core'
import { TmwkPreferenceListParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const PREFERENCE_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.preferenceList',
    permission: 'workspace',
    params: TmwkPreferenceListParams,
    handler: (): { records: TmwkRecord[]; partial: boolean } => {
      requireTmwkHomeHost()
      return { records: [], partial: false }
    }
  })
]
