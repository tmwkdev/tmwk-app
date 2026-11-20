import { describe, expect, it } from 'vitest'
import { parseTicketOptions } from './ticket-options-store'

describe('parseTicketOptions', () => {
  it('falls back to defaults for a corrupt value and keeps the valid fields of a partial one', () => {
    expect(parseTicketOptions('{not json').groupBy).toBe('attention')
    const parsed = parseTicketOptions(
      JSON.stringify({
        groupBy: 'galaxy',
        density: 'one-line',
        hideDone: 'yes',
        hideQuiet: true,
        showOnRows: { pr: true, reason: 3 },
        statusOrder: ['done', 'bogus', 7, 'blocked']
      })
    )
    expect(parsed).toEqual({
      groupBy: 'attention',
      sortWithin: 'attention',
      density: 'one-line',
      showOnRows: {
        reason: true,
        project: false,
        host: false,
        agent: false,
        lastActivity: false,
        pr: true
      },
      hideDone: false,
      hideOngoing: false,
      hideQuiet: true,
      statusOrder: [
        'done',
        'blocked',
        'needsDecision',
        'readyForReview',
        'running',
        'waiting',
        'paused'
      ]
    })
  })
})
