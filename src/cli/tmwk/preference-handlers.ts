import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { TmwkRecord } from '../../shared/tmwk/tmwk-records'
import { callTmwk } from './tmwk-rpc-call'

type PreferenceListResult = { records: TmwkRecord[]; partial: boolean }

function formatPreferenceList(result: PreferenceListResult): string {
  if (result.records.length === 0) {
    return 'No standing preferences.'
  }
  return [
    `Standing preferences (${result.records.length})`,
    ...result.records.map((record) => `${record.id}  ${record.text}`)
  ].join('\n')
}

export const TMWK_PREFERENCE_HANDLERS: Record<string, CommandHandler> = {
  'tmwk preference list': async ({ flags, client, json }) => {
    const project = getOptionalStringFlag(flags, 'project')
    const response = await callTmwk<PreferenceListResult>(client, 'tmwk.preferenceList', {
      ...(project === undefined ? {} : { project }),
      ...(flags.get('history') === true ? { history: true } : {})
    })
    printResult(response, json, formatPreferenceList)
  }
}
