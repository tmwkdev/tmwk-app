import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TmwkTicketRequestParams } from '../../../shared/rpc-contract/tmwk/tmwk-rpc-params'
import { TmwkRpcError } from '../main-session/tmwk-runtime-rpc'
import { sendMainNotice } from '../notices/send-main-notice'
import { createTicketStore, type TicketStore } from '../tickets/ticket-store'
import { requestTicket } from './ticket-request-rpc-methods'

describe('tmwk.ticketRequest', () => {
  let root: string
  let store: TicketStore
  const rpc = vi.fn<(method: string, params?: unknown) => Promise<unknown>>()
  const request = (params: Record<string, unknown>) =>
    requestTicket(TmwkTicketRequestParams.parse(params), {
      store,
      lookup: async () => ({ id: 'repo_1', displayName: 'tmwk-app' }),
      post: (notice) => sendMainNotice(rpc, 'partner', notice)
    })

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-request-'))
    store = createTicketStore(join(root, 'store'))
    rpc.mockReset()
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates a requested ticket and posts the request event to Chat', async () => {
    rpc.mockResolvedValue({})
    const result = await request({
      words: 'Fix stale avatars\nafter an account switch',
      project: 'id:repo_1',
      runOn: 'auto',
      runOnLabel: 'Auto',
      agent: 'claude'
    })
    expect(result.ticket.status).toBe('requested')
    expect(result.ticket.projectId).toBe('repo_1')
    expect(result.delivery).toEqual({ via: 'mail' })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [method, params] = rpc.mock.calls[0]!
    expect(method).toBe('orchestration.send')
    const sent = params as { to: string; from: string; payload: string }
    expect(sent.to).toBe('orca_session_id:partner')
    expect(sent.from).toBe('tmwk')
    expect(JSON.parse(sent.payload)).toEqual({
      tmwk: 'ticket-request',
      ticketId: result.ticket.id,
      title: 'Fix stale avatars',
      words: 'Fix stale avatars\nafter an account switch',
      project: { repoId: 'repo_1', name: 'tmwk-app' },
      runOn: 'auto',
      runOnLabel: 'Auto',
      agent: 'claude',
      requestedAt: result.ticket.createdAt
    })
  })

  it('keeps the ticket requested when Chat does not get the notice, and Retry posts it again', async () => {
    rpc.mockRejectedValueOnce(new TmwkRpcError('recipient_delivery_held', 'held'))
    const first = await request({ words: 'Ship release notes' })
    expect(first.ticket.status).toBe('requested')
    expect(first.delivery).toEqual({ failed: 'held' })

    rpc.mockResolvedValueOnce({})
    const retried = await request({ ticket: first.ticket.id })
    expect(retried.ticket.id).toBe(first.ticket.id)
    expect(retried.delivery).toEqual({ via: 'mail' })
    expect((await store.list()).tickets).toHaveLength(1)
  })
})
