import { defineMethod } from '../../runtime/rpc/core'
import { TmwkNoteSaveParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { openTmwkStore } from '../store/open-tmwk-store'
import { resolveTmwkProject } from '../store/repo-project-resolver'
import { requireTmwkHomeHost } from './tmwk-home-host-guard'

export const NOTE_RPC_METHODS = [
  defineMethod({
    name: 'tmwk.noteSave',
    permission: 'workspace',
    params: TmwkNoteSaveParams,
    handler: async (params, context): Promise<{ record: TmwkRecord }> => {
      requireTmwkHomeHost()
      const project = await resolveTmwkProject(
        (selector) => context.runtime.showRepo(selector),
        params.project
      )
      const { record } = await openTmwkStore().add({
        kind: 'note',
        text: params.text.trim(),
        project,
        source: params.source ?? null
      })
      return { record }
    }
  })
]
