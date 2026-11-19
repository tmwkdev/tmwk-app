import { TMWK_SUMMARY_MAX_CHARS, type TmwkSummary } from '../../../shared/tmwk/tmwk-summaries'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { openTmwkSummaryStore } from '../store/open-tmwk-store'
import { renderTranscript } from '../summary/refresh-working-summary'

const FALLBACK_ENTRIES = 100
const PREVIOUS_SUMMARY_MAX_CHARS = 1500
const RECENT_TURNS_LABEL = 'Recent turns:\n'
export const FALLBACK_SUMMARY_HEADER =
  '[Fallback summary: the working summary could not be refreshed. Last summary and recent turns follow.]'

/** The last summary plus the old session's recent turns, stored with reason `fallback`; null when there is nothing to keep. */
export async function storeFallbackSummary(
  rpc: TmwkRpc,
  session: { sessionId: string; agent: string }
): Promise<TmwkSummary | null> {
  const store = openTmwkSummaryStore()
  const previous = await store.latest()
  const transcript = await rpc('agent.read', { id: session.sessionId, limit: FALLBACK_ENTRIES })
    .then(renderTranscript)
    .catch((error: unknown) => {
      console.error('[tmwk] fallback transcript not read:', error)
      return ''
    })
  const sections = [FALLBACK_SUMMARY_HEADER]
  if (previous) {
    sections.push(`Last summary:\n${previous.text.slice(0, PREVIOUS_SUMMARY_MAX_CHARS)}`)
  }
  if (!transcript && !previous) {
    return null
  }
  if (transcript) {
    const used = sections.join('\n\n').length + '\n\n'.length + RECENT_TURNS_LABEL.length
    const room = TMWK_SUMMARY_MAX_CHARS - used
    if (room > 0) {
      sections.push(`${RECENT_TURNS_LABEL}${transcript.slice(-room)}`)
    }
  }
  return store.add({
    text: sections.join('\n\n').slice(0, TMWK_SUMMARY_MAX_CHARS),
    sessionId: session.sessionId,
    agent: session.agent,
    reason: 'fallback'
  })
}
