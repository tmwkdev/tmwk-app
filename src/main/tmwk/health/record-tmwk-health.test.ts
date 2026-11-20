import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActiveSink } from '../../observability/tracer'
import { TMWK_FAILURE_KINDS } from '../../../shared/tmwk/tmwk-health'
import { openTmwkHealthStore, recordTmwkFailure, recordTmwkRollover } from './record-tmwk-health'

describe('tmwk health recording', () => {
  let root: string
  let spans: unknown[]
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tmwk-health-'))
    vi.stubEnv('TMWK_HOME', root)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    spans = []
    setActiveSink({
      push: (record) => spans.push(record),
      flush() {},
      close() {}
    })
  })
  afterEach(async () => {
    setActiveSink(null)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  it.each(TMWK_FAILURE_KINDS)(
    'records a %s failure as a failed span and a health entry',
    async (kind) => {
      await recordTmwkFailure(kind, 'stage-a', new Error('tmwk_session_changed: the chat changed'))
      expect(spans).toEqual([
        expect.objectContaining({
          name: `tmwk.${kind}`,
          attributes: { 'tmwk.stage': 'stage-a', 'tmwk.code': 'session_changed' },
          exit: expect.objectContaining({ _tag: 'Failure' })
        })
      ])
      expect(await openTmwkHealthStore().list()).toEqual([
        {
          type: 'failure',
          kind,
          stage: 'stage-a',
          message: 'the chat changed',
          code: 'session_changed',
          at: expect.any(String),
          repeats: 1
        }
      ])
    }
  )

  it('folds a failure that repeats the newest one, across a rollover', async () => {
    await recordTmwkFailure('ticket-refresh', 'snapshot', new Error('host gone'))
    await recordTmwkRollover('fallback', {})
    await recordTmwkFailure('ticket-refresh', 'snapshot', new Error('host gone'))
    await recordTmwkFailure('summary', 'refresh', 'empty')
    const events = await openTmwkHealthStore().list()
    expect(
      events.map((e) => (e.type === 'failure' ? `${e.kind}x${e.repeats}` : e.summary))
    ).toEqual(['fallback', 'ticket-refreshx2', 'summaryx1'])
    expect(spans).toEqual(
      ['tmwk.ticket-refresh', 'tmwk.rollover', 'tmwk.ticket-refresh', 'tmwk.summary'].map((name) =>
        expect.objectContaining({ name })
      )
    )
  })

  it('keeps the trace span when the health file is unreadable', async () => {
    vi.stubEnv('TMWK_HOME', 'relative/not-allowed')
    await expect(recordTmwkFailure('rollover', 'automatic', 'x')).resolves.toBeUndefined()
    expect(spans).toHaveLength(1)
  })
})
