import type { CommandHandler } from '../dispatch/dispatch'
import {
  getOptionalNonNegativeIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import type { TmwkTicketListing } from '../../shared/tmwk/tmwk-tickets'
import type { TmwkTicketShow } from '../../shared/tmwk/tmwk-ticket-record'
import { callTmwk } from './tmwk-rpc-call'

type TicketsResult = { version: number; tickets: TmwkTicketListing[] }

const NEEDS_ME_TAG: Record<NonNullable<TmwkTicketListing['needsMe']>, string> = {
  decision: '[decision]',
  stop: '[stop]',
  result: '[result]'
}

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0]
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

function formatCard(ticket: TmwkTicketListing): string {
  const tag = ticket.needsMe === null ? '[-]' : NEEDS_ME_TAG[ticket.needsMe]
  const accepted = ticket.acceptedAt === null ? '' : ', accepted'
  const ongoing = ticket.kind === 'ongoing' ? ', ongoing' : ''
  const task = ticket.taskId === null ? '' : `  ${ticket.taskId}`
  const head = `${tag} ${ticket.title}  (${ticket.status}${accepted}${ongoing})  ${ticket.id}${task}`
  const detail = ticket.question ?? ticket.failure ?? ticket.result
  return detail ? `${head}\n    ${firstLine(detail)}` : head
}

function formatTickets(result: TicketsResult): string {
  const cards = result.tickets.length === 0 ? ['No tickets.'] : result.tickets.map(formatCard)
  return [...cards, `version ${result.version}`].join('\n')
}

function formatShow({ ticket, listing }: TmwkTicketShow): string {
  const attempts = ticket.attempts.map((attempt, index) => {
    const state = attempt.outcome ?? attempt.observed?.status ?? 'starting'
    const where = attempt.host ?? 'home host'
    const launch = [attempt.agent, attempt.model, attempt.effort].filter(Boolean).join(' ')
    const branch = attempt.branch ? `  branch ${attempt.branch}` : ''
    const pr = attempt.pr ? `  PR #${attempt.pr.number} ${attempt.pr.state}` : ''
    return `  ${index + 1}. ${state}  task ${attempt.taskId ?? '-'}  dispatch ${attempt.dispatchId ?? '-'}  ${launch} on ${where}${branch}${pr}`
  })
  return [
    formatCard(listing),
    ...(ticket.words ? [`Words: ${firstLine(ticket.words)}`] : []),
    ...(ticket.source ? [`Source: ${ticket.source.key} ${ticket.source.url}`] : []),
    ...(ticket.question
      ? [
          `Question ${ticket.question.id}: ${ticket.question.text}`,
          ...(ticket.question.recommend ? [`Recommend: ${ticket.question.recommend}`] : [])
        ]
      : []),
    attempts.length === 0 ? 'No attempts yet.' : 'Attempts:',
    ...attempts
  ].join('\n')
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
    const response = await callTmwk<{ ticket: TmwkTicketListing }>(client, 'tmwk.ticketAccept', {
      taskId: getRequiredStringFlag(flags, 'taskId')
    })
    printResult(response, json, (result) => `Accepted ${result.ticket.id}.`)
  },
  'tmwk ticket show': async ({ flags, client, json }) => {
    const response = await callTmwk<TmwkTicketShow>(client, 'tmwk.ticketShow', {
      ticket: getRequiredStringFlag(flags, 'ticket')
    })
    printResult(response, json, formatShow)
  },
  'tmwk ticket ask': async ({ flags, client, json }) => {
    const recommend = getOptionalStringFlag(flags, 'recommend')
    const response = await callTmwk<TmwkTicketShow>(client, 'tmwk.ticketAsk', {
      ticket: getRequiredStringFlag(flags, 'ticket'),
      question: getRequiredStringFlag(flags, 'question'),
      ...(recommend ? { recommend } : {})
    })
    printResult(
      response,
      json,
      (result) =>
        `${result.ticket.id} now waits on the user's decision (${result.ticket.question?.id}).`
    )
  }
}
