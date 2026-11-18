import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { TmwkRecord } from '../../shared/tmwk/tmwk-records'
import { callTmwk } from './tmwk-rpc-call'

export const TMWK_NOTE_HANDLERS: Record<string, CommandHandler> = {
  'tmwk note save': async ({ flags, client, json }) => {
    const project = getOptionalStringFlag(flags, 'project')
    const source = getOptionalStringFlag(flags, 'source')
    const response = await callTmwk<{ record: TmwkRecord }>(client, 'tmwk.noteSave', {
      text: getRequiredStringFlag(flags, 'text'),
      ...(project === undefined ? {} : { project }),
      ...(source === undefined ? {} : { source })
    })
    printResult(response, json, (result) => `Saved ${result.record.id}.`)
  }
}
