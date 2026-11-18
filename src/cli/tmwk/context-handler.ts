import type { CommandHandler } from '../dispatch/dispatch'
import { printResult } from '../output/command-result-output'
import { callTmwk } from './tmwk-rpc-call'

export const TMWK_CONTEXT_HANDLERS: Record<string, CommandHandler> = {
  'tmwk context': async ({ client, json }) => {
    const response = await callTmwk<{ text: string; partial: boolean }>(client, 'tmwk.context')
    printResult(response, json, (result) => result.text)
  }
}
