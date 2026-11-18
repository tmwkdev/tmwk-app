import type { TmwkRecord } from '../../../shared/tmwk/tmwk-records'
import { tmwkError } from '../tmwk-error'
import { PREFERENCE_PARTIAL_LINE, renderPreferenceBriefing } from './render-preference-briefing'

export const EVIDENCE_EXCERPT_CHARS = 1500
export const EVIDENCE_TOTAL_CHARS = 6000

export type OwnerBriefEvidence = { sourceId: string; text: string }

export type OwnerBriefInput = {
  goal: string
  words?: string
  /** Records in effect. Only preferences are used; a note reaches the brief only as cited evidence. */
  effective: TmwkRecord[]
  projectId: string | null
  evidence: OwnerBriefEvidence[]
  maxBytes: number
  excerptChars?: number
  totalChars?: number
}

export type OwnerBrief = { text: string; partial: boolean }

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function renderOwnerBrief(input: OwnerBriefInput): OwnerBrief {
  const excerptChars = input.excerptChars ?? EVIDENCE_EXCERPT_CHARS
  const totalChars = input.totalChars ?? EVIDENCE_TOTAL_CHARS
  const preferences = renderPreferenceBriefing(
    input.effective.filter((record) => record.kind === 'preference'),
    input.projectId
  )
  const words = input.words?.trim()
  const base = [
    `## Goal\n${input.goal.trim()}`,
    ...(words ? [`## The user's words\n${words}`] : []),
    `## Standing preferences\n${preferences.text}`
  ].join('\n\n')
  if (byteLength(base) > input.maxBytes) {
    throw tmwkError(
      'brief_too_large',
      `the goal and words alone exceed ${input.maxBytes} bytes; shorten them or point the owner at a file`
    )
  }

  let partial = preferences.partial
  let text = base
  if (input.evidence.length > 0) {
    let remaining = totalChars
    const sections: string[] = []
    for (const item of input.evidence) {
      const limit = Math.min(excerptChars, remaining)
      const excerpt = item.text.slice(0, Math.max(limit, 0))
      if (excerpt.length < item.text.length) {
        partial = true
      }
      remaining -= excerpt.length
      sections.push(`### ${item.sourceId}\n${excerpt}`)
    }
    text = `${base}\n\n## Evidence\n${sections.join('\n\n')}`
    if (byteLength(text) > input.maxBytes) {
      throw tmwkError(
        'brief_too_large',
        `the brief exceeds ${input.maxBytes} bytes; cite less evidence or shorten the goal`
      )
    }
  }
  if (partial && !text.includes(PREFERENCE_PARTIAL_LINE)) {
    text = `${text}\n\n${PREFERENCE_PARTIAL_LINE}`
  }
  return { text, partial }
}
