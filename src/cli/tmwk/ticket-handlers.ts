import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalNonNegativeIntegerFlag, getRequiredStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { TmwkTicket } from '../../shared/tmwk/tmwk-tickets'
import { callTmwk } from './tmwk-rpc-call'

type TicketsResult = { version: number; tickets: TmwkTicket[] }

const NEEDS_ME_TAG: Record<NonNullable<TmwkTicket['needsMe']>, string> = {
  decision: '[decision]',
  stop: '[stop]',
  result: '[result]'
}

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0]
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

function formatCard(ticket: TmwkTicket): string {
  const tag = ticket.needsMe === null ? '[-]' : NEEDS_ME_TAG[ticket.needsMe]
  const accepted = ticket.acceptedAt === null ? '' : ', accepted'
  const head = `${tag} ${ticket.title}  (${ticket.status}${accepted})  ${ticket.taskId}`
  const detail = ticket.question ?? ticket.result
  return detail ? `${head}\n    ${firstLine(detail)}` : head
}

function formatTickets(result: TicketsResult): string {
  const cards = result.tickets.length === 0 ? ['No tickets.'] : result.tickets.map(formatCard)
  return [...cards, `version ${result.version}`].join('\n')
}

export const TMWK_TICKET_HANDLERS: Record<string, CommandHandler> = {
  'tmwk tickets': async ({ flags, client, json }) => {
    const since = getOptionalNonNegativeIntegerFlag(flags, 'since')
    const response = await callTmwk<TicketsResult>(client, 'tmwk.tickets', {
      ...(flags.get('needs-me') === true ? { needsMe: true } : {}),
      ...(since === undefined ? {} : { since })
    })
    printResult(response, json, formatTickets)
  },
  'tmwk tickets accept': async ({ flags, client, json }) => {
    const response = await callTmwk<{ ticket: TmwkTicket }>(client, 'tmwk.ticketAccept', {
      taskId: getRequiredStringFlag(flags, 'taskId')
    })
    printResult(response, json, (result) => `Accepted ${result.ticket.taskId}.`)
  }
}
