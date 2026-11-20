import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TmwkTicketAnswerParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import type { TicketDecision } from '../../../shared/tmwk/ticket-view'
import { TmwkRpcError } from '../main-session/tmwk-runtime-rpc'
import { createTicketStore, type TicketStore } from '../tickets/ticket-store'
import { answerTicket } from './ticket-answer-rpc-methods'

const GATE: TicketDecision = {
  kind: 'gate',
  id: 'gate_1',
  text: 'Keep the legacy shortcuts panel?',
  recommend: null,
  options: ['Remove it', 'Keep for one release'],
  askedAt: null
}

describe('tmwk.ticketAnswer', () => {
  let root: string
  let store: TicketStore
  let ticketId: string
  const asPartner = vi.fn<(method: string, params?: unknown) => Promise<unknown>>()
  const notify = vi.fn<() => Promise<{ via: 'mail' | 'send' }>>()
  const answer = (params: Record<string, unknown>, decision: TicketDecision | null = GATE) =>
    answerTicket(TmwkTicketAnswerParams.parse({ ticket: ticketId, ...params }), {
      store,
      readDecision: async () => decision,
      ownerHandle: async () => null,
      delivery: { asPartner, rpc: vi.fn(), notify }
    })

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-answer-'))
    store = createTicketStore(join(root, 'store'))
    const created = await store.create({ words: 'New settings page' })
    ticketId = created.ticket.id
    await store.attach(ticketId, { runId: 'run_main', taskId: 'task_1', dispatchId: 'd_1' })
    asPartner.mockReset()
    notify.mockReset()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('records the answer, then resolves the gate as the partner', async () => {
    asPartner.mockResolvedValue({})
    const result = await answer({ answer: 'Remove it', decision: 'gate_1' })
    expect(asPartner).toHaveBeenCalledWith('orchestration.gateResolve', {
      id: 'gate_1',
      resolution: 'Remove it',
      run: 'run_main'
    })
    expect(notify).not.toHaveBeenCalled()
    expect(result.ticket.history.at(-1)).toMatchObject({
      kind: 'answered',
      text: 'Remove it',
      decisionKind: 'gate',
      decisionId: 'gate_1',
      delivery: { status: 'delivered', via: 'partner' }
    })
  })

  it('keeps a failed delivery in the thread, and Retry delivers the same answer through Chat', async () => {
    asPartner.mockRejectedValue(new TmwkRpcError('session_not_live', 'not live'))
    notify.mockRejectedValueOnce(new Error('Chat has not started yet.'))
    const failed = await answer({ answer: 'Remove it', decision: 'gate_1' })
    const event = failed.ticket.history.at(-1)
    expect(event).toMatchObject({
      kind: 'answered',
      delivery: { status: 'failed', error: 'Chat has not started yet.' }
    })

    notify.mockResolvedValueOnce({ via: 'mail' })
    const retried = await answer({ retry: event?.id })
    const answers = retried.ticket.history.filter((e) => e.kind === 'answered')
    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ delivery: { status: 'delivered', via: 'notice' } })
  })

  it('closes the partner’s own question once its answer reaches Chat', async () => {
    const asked = await store.ask(ticketId, { text: 'Which page first?' })
    const question = asked.ticket.question
    notify.mockResolvedValue({ via: 'mail' })
    const result = await answer(
      { answer: 'Shortcuts first' },
      {
        kind: 'ask',
        id: question?.id ?? '',
        text: 'Which page first?',
        recommend: null,
        options: [],
        askedAt: null
      }
    )
    expect(asPartner).not.toHaveBeenCalled()
    expect(result.ticket.question).toBeUndefined()
    expect(result.listing.needsMe).toBeNull()
  })
})
