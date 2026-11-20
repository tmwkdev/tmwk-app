import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { NeedsYouSummary } from '../../../../../shared/tmwk/ticket-overview/ticket-attention'
import { TicketStateGlyph } from './ticket-glyphs'

const KINDS = ['decision', 'stop', 'result'] as const

/** Pinned above every grouping but Attention: what needs you, counted across filters and collapsed groups (D63). Clicking moves focus to the next needs-you row. */
export function NeedsYouStrip({
  summary,
  scopeLabel,
  onJump
}: {
  summary: NeedsYouSummary
  /** The project filter's label, when one excludes some projects. */
  scopeLabel: string | null
  onJump: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const scope = scopeLabel ? (
    <span className="min-w-0 truncate text-muted-foreground">
      {t('tmwk.tickets.needsYouScope', 'in {{project}}', { project: scopeLabel })}
    </span>
  ) : null
  return (
    <div className="sticky top-0 z-10 bg-worktree-sidebar pb-1">
      {summary.total === 0 ? (
        <div
          role="status"
          className="flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground"
        >
          {t('tmwk.tickets.nothingNeedsYou', 'Nothing needs you')}
          {scope}
        </div>
      ) : (
        <button
          type="button"
          onClick={onJump}
          aria-label={t('tmwk.tickets.needsYouJump', '{{count}} need you. Go to the next one', {
            count: summary.total
          })}
          className="mx-0.5 flex h-8 w-[calc(100%-4px)] items-center gap-2 rounded-md border border-worktree-sidebar-border px-2 text-xs text-worktree-sidebar-foreground outline-none hover:bg-worktree-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-worktree-sidebar-ring"
        >
          <span className="font-medium">{t('tmwk.tickets.needsYou', 'Needs you')}</span>
          <span className="tabular-nums text-muted-foreground">{summary.total}</span>
          {scope}
          <span className="flex-1" />
          {KINDS.map(
            (kind) =>
              summary[kind] > 0 && (
                <span key={kind} className="flex items-center gap-1 tabular-nums">
                  <TicketStateGlyph state={kind} />
                  {summary[kind]}
                </span>
              )
          )}
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
