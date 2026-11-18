import { describe, expect, it } from 'vitest'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { renderPreferenceBriefing } from './render-preference-briefing'

function pref(id: string, text: string, createdAt: string, repoId?: string): TmwkRecord {
  return {
    id,
    kind: 'preference',
    text,
    project: repoId ? { repoId, name: repoId } : null,
    source: null,
    createdAt,
    supersedes: null,
    supersededBy: null,
    retiredAt: null
  }
}

describe('renderPreferenceBriefing', () => {
  const records = [
    pref('pref_00000001', 'oldest rule', '2026-01-01T00:00:00Z'),
    pref('pref_00000002', 'middle rule', '2026-02-01T00:00:00Z'),
    pref('pref_00000003', 'newest rule', '2026-03-01T00:00:00Z')
  ]

  it('lists newest first with no partial line when everything fits', () => {
    expect(renderPreferenceBriefing(records, null, 1000)).toEqual({
      text: [
        'Standing preferences (3)',
        'pref_00000003  newest rule',
        'pref_00000002  middle rule',
        'pref_00000001  oldest rule'
      ].join('\n'),
      partial: false
    })
  })

  it('drops the oldest whole rule first and says the briefing is partial', () => {
    const result = renderPreferenceBriefing(records, null, 80)
    expect(result.partial).toBe(true)
    expect(result.text).toBe(
      [
        'Standing preferences (2)',
        'pref_00000003  newest rule',
        'pref_00000002  middle rule',
        'Briefing is partial: some standing preferences did not fit. Ask the partner before any outward or irreversible action.'
      ].join('\n')
    )
  })

  it("leaves another project's preference out", () => {
    const mixed = [
      ...records.slice(0, 1),
      pref('pref_0000000a', 'repo rule', '2026-04-01T00:00:00Z', 'r2')
    ]
    expect(renderPreferenceBriefing(mixed, 'r1', 1000).text).not.toContain('repo rule')
    expect(renderPreferenceBriefing(mixed, 'r2', 1000).text).toContain(
      'pref_0000000a  [r2] repo rule'
    )
  })
})
