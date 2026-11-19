import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { MainSessionRolloverResult } from '../../shared/tmwk/main-session-switch'
import { callTmwk } from './tmwk-rpc-call'

export const TMWK_MAIN_SESSION_HANDLERS: Record<string, CommandHandler> = {
  'tmwk main rollover': async ({ flags, client, json }) => {
    const agent = getOptionalStringFlag(flags, 'agent')
    const response = await callTmwk<MainSessionRolloverResult>(
      client,
      'tmwk.mainSession.rollover',
      agent ? { agent } : {}
    )
    printResult(response, json, (result) =>
      result.state === 'scheduled' ? 'Rollover scheduled after this turn.' : 'Rollover started.'
    )
  }
}
