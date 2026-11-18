import type { CommandHandler } from '../dispatch/dispatch'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import { callTmwk } from './tmwk-rpc-call'

export const TMWK_AWAY_HANDLERS: Record<string, CommandHandler> = {
  'tmwk away': async ({ flags, client, json }) => {
    if (flags.get('preview') !== true) {
      throw new RuntimeClientError('invalid_argument', 'Pass --preview.')
    }
    const response = await callTmwk<{ text: string | null }>(client, 'tmwk.awayPreview')
    if (response.result.text === null && !json) {
      return
    }
    printResult(response, json, (result) => result.text ?? '')
  }
}
