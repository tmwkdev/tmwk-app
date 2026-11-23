import { describe, expect, it } from 'vitest'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { readLiveTickets } from './read-live-tickets'

function task(id: string, status: string) {
  return { id, run_id: 'run_1', spec: `Task ${id}`, status, result: null, completed_at: null }
}

function question(id: string, taskId: string) {
  return {
    id,
    type: 'question',
    body: `which for ${taskId}?`,
    thread_id: id,
    payload: JSON.stringify({ taskId, dispatchId: `ctx_${taskId}` })
  }
}

function escalation(id: string, taskId: string, stopReason: string) {
  return {
    id,
    type: 'escalation',
    body: `${taskId} stopped`,
    thread_id: null,
    payload: JSON.stringify({ taskId, dispatchId: `ctx_${taskId}`, handle: 'term_1', stopReason })
  }
}

function worker(taskId: string, workerState: string, dispatchStatus: string, server = false) {
  return {
    dispatchId: `ctx_${taskId}`,
    taskId,
    workerState,
    dispatchStatus,
    ...(server ? { server: { environmentId: 'env_mbp', name: 'mbp', asOf: '2026-11-22' } } : {})
  }
}

function rpcWith(tasks: unknown[], messages: unknown[], workers: unknown[]): TmwkRpc {
  const replies: Record<string, unknown> = {
    'orchestration.runList': { runs: [{ id: 'run_1', objective: 'main' }] },
    'orchestration.taskList': { tasks },
    'orchestration.gateList': { gates: [] },
    'orchestration.inbox': { messages },
    'orchestration.workerList': { workers }
  }
  return async (method) => replies[method]
}

describe('readLiveTickets', () => {
  it("drops an unanswered question once its owner's dispatch ends, home or paired server", async () => {
    const ids = ['live', 'unknown', 'stopped', 'remote']
    const rpc = rpcWith(
      [
        task('live', 'dispatched'),
        task('unknown', 'blocked'),
        task('stopped', 'blocked'),
        task('remote', 'blocked')
      ],
      ids.map((id, n) => question(`m${n}`, id)),
      [
        worker('live', 'ready', 'dispatched'),
        worker('unknown', 'start_unknown', 'dispatched'),
        worker('stopped', 'stopped', 'failed'),
        worker('remote', 'stopped', 'failed', true)
      ]
    )
    const { tickets } = await readLiveTickets(rpc)
    expect(tickets.map((t) => [t.taskId, t.question])).toEqual([
      ['live', 'which for live?'],
      ['unknown', 'which for unknown?'],
      ['stopped', null],
      ['remote', null]
    ])
  })
  it("names why a ready Task's owners all ended before reporting", async () => {
    const rpc = rpcWith(
      [
        task('exited', 'ready'),
        task('remote', 'ready'),
        task('fresh', 'ready'),
        task('retried', 'dispatched')
      ],
      [escalation('m0', 'exited', 'exited')],
      [
        worker('exited', 'failed', 'failed'),
        worker('remote', 'failed', 'circuit_broken', true),
        worker('retried', 'failed', 'failed')
      ]
    )
    const { tickets } = await readLiveTickets(rpc)
    expect(tickets.map((t) => [t.taskId, t.ownerGone !== null])).toEqual([
      ['exited', true],
      ['remote', true],
      ['fresh', false],
      ['retried', false]
    ])
    expect(tickets[0].ownerGone).not.toBe(tickets[1].ownerGone)
  })
})
