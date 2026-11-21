import { describe, expect, it } from 'vitest'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { readTicketCode } from './read-ticket-code'

const shown: TmwkRpc = async () => ({
  worktree: {
    linkedPR: 67,
    linkedItems: [
      { type: 'issue', number: 67, url: 'https://github.com/tmwkdev/tmwk-app/issues/67' },
      { type: 'pr', number: 67, url: 'https://github.com/tmwkdev/tmwk-app/pull/67' }
    ],
    git: { branch: 'refs/heads/tykowale/squirrelfish' }
  }
})

describe('readTicketCode', () => {
  it("gives the linked PR its review's URL so the rail can open it", async () => {
    await expect(readTicketCode(shown, 'wt_1')).resolves.toEqual({
      branch: 'tykowale/squirrelfish',
      pr: { number: 67, url: 'https://github.com/tmwkdev/tmwk-app/pull/67' }
    })
  })
})
