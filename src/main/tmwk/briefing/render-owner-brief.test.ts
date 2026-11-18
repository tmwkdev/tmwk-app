import { describe, expect, it } from 'vitest'
import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { renderOwnerBrief } from './render-owner-brief'

function record(id: string, kind: TmwkRecord['kind'], text: string, repoId?: string): TmwkRecord {
  return {
    id,
    kind,
    text,
    project: repoId ? { repoId, name: repoId } : null,
    source: null,
    createdAt: '2026-01-01T00:00:00Z',
    supersedes: null,
    supersededBy: null,
    retiredAt: null
  }
}

describe('renderOwnerBrief', () => {
  const effective = [
    record('pref_00000001', 'preference', 'global rule'),
    record('pref_00000002', 'preference', 'alpha rule', 'alpha'),
    record('pref_00000003', 'preference', 'beta rule', 'beta'),
    record('note_00000001', 'note', 'uncited note')
  ]

  it('includes global and own-project preferences, and no uncited note', () => {
    const { text } = renderOwnerBrief({
      goal: 'Ship it',
      effective,
      projectId: 'alpha',
      evidence: [],
      maxBytes: 100000
    })
    expect(text).toContain('global rule')
    expect(text).toContain('alpha rule')
    expect(text).not.toContain('beta rule')
    expect(text).not.toContain('uncited note')
  })

  it('shows a note only when it is cited as evidence', () => {
    const { text } = renderOwnerBrief({
      goal: 'Ship it',
      effective,
      projectId: null,
      evidence: [{ sourceId: 'note:note_00000001', text: 'uncited note' }],
      maxBytes: 100000
    })
    expect(text).toContain('### note:note_00000001\nuncited note')
  })
})
