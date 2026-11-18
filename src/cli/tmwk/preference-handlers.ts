import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { TmwkRecord } from '../../shared/tmwk/tmwk-records'
import { callTmwk } from './tmwk-rpc-call'

type PreferenceSetResult = { record: TmwkRecord; superseded: string[] }

function formatPreferenceSet({ record, superseded }: PreferenceSetResult): string {
  const scope = record.project ? record.project.name : 'global'
  return [`Saved ${record.id} (${scope}).`, ...superseded.map((id) => `Replaced ${id}.`)].join('\n')
}

export const TMWK_PREFERENCE_HANDLERS: Record<string, CommandHandler> = {
  'tmwk preference set': async ({ flags, client, json }) => {
    const project = getOptionalStringFlag(flags, 'project')
    const supersedes = getOptionalStringFlag(flags, 'supersedes')
    const response = await callTmwk<PreferenceSetResult>(client, 'tmwk.preferenceSet', {
      text: getRequiredStringFlag(flags, 'text'),
      ...(project === undefined ? {} : { project }),
      ...(supersedes === undefined ? {} : { supersedes })
    })
    printResult(response, json, formatPreferenceSet)
  },
  'tmwk preference list': async ({ flags, client, json }) => {
    const project = getOptionalStringFlag(flags, 'project')
    const response = await callTmwk<{ records: TmwkRecord[]; partial: boolean; text: string }>(
      client,
      'tmwk.preferenceList',
      {
        ...(project === undefined ? {} : { project }),
        ...(flags.get('history') === true ? { history: true } : {})
      }
    )
    printResult(response, json, (result) => result.text)
  },
  'tmwk preference remove': async ({ flags, client, json }) => {
    const response = await callTmwk<{ record: TmwkRecord }>(client, 'tmwk.preferenceRemove', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(response, json, (result) => `Removed ${result.record.id}.`)
  }
}
