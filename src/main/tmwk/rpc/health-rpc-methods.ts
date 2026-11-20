import { defineMethod } from '../../runtime/rpc/core'
import { TmwkHealthParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkHealthView } from '../../../shared/tmwk/tmwk-health'
import { readTmwkHealth } from '../health/read-tmwk-health'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const HEALTH_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.health',
    permission: 'workspace',
    params: TmwkHealthParams,
    handler: (): Promise<TmwkHealthView> => {
      requireTmwkHomeHost()
      return readTmwkHealth()
    }
  })
]
