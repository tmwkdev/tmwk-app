import React from 'react'
import { GitBranch, GitPullRequest, LayoutGrid } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { Button } from '@/components/ui/button'
import { formatPaletteSessionAge } from '@/components/cmd-j/palette-session-age'
import { useNow } from '@/lib/window-activity/use-now'
import { useTranslate } from '@/i18n/use-translate'
import type {
  TicketRowModel,
  TicketRowSession
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import { TicketSessionGlyph } from '../tickets/ticket-glyphs'
import { useUnreachableHostText } from '../tickets/ticket-row-parts'

function RailSection({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{label}</h2>
      {children}
    </section>
  )
}

function WhereText({ row }: { row: TicketRowModel }): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(60_000)
  const unreachable = useUnreachableHostText(row.host)
  const lastActivity = row.lastActivityAt ? Date.parse(row.lastActivityAt) : Number.NaN
  const age = Number.isNaN(lastActivity) ? undefined : formatPaletteSessionAge(lastActivity, now, t)
  const host = row.host?.label ?? t('tmwk.ticketView.homeHost', 'The home host')
  return (
    <div className="px-2 text-xs leading-5 text-muted-foreground">
      {unreachable ??
        (age
          ? t('tmwk.ticketView.whereWithReport', '{{host}}. Last report {{age}} ago.', {
              host,
              age
            })
          : t('tmwk.ticketView.where', '{{host}}.', { host }))}
    </div>
  )
}

/** Sessions with their models, Watch all, Code and Where (T4's quiet rail). */
export function TicketRail({
  row,
  onOpenSession,
  onWatchAll
}: {
  row: TicketRowModel
  onOpenSession: (session: TicketRowSession) => void
  /** Absent when no owner worktree is known here. */
  onWatchAll?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex flex-col gap-5">
      <RailSection label={t('tmwk.ticketView.sessions', 'Sessions')}>
        {row.sessions.length === 0 && (
          <div className="px-2 text-xs text-muted-foreground">
            {t('tmwk.ticketView.noSessions', 'No sessions yet')}
          </div>
        )}
        {row.sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onOpenSession(session)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TicketSessionGlyph status={session.status} />
            <AgentIcon agent={session.agent} size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{session.role}</span>
            {session.model && (
              <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                {session.model}
              </span>
            )}
          </button>
        ))}
        {onWatchAll && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onWatchAll}
            className="mt-1 w-full justify-start"
          >
            <LayoutGrid className="size-4" />
            {t('tmwk.ticketView.watchAll', 'Watch all')}
          </Button>
        )}
      </RailSection>
      <RailSection label={t('tmwk.ticketView.code', 'Code')}>
        <div className="flex h-8 items-center gap-2 px-2">
          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
          {row.branch ? (
            <span className="truncate font-mono text-xs">{row.branch}</span>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {t('tmwk.ticketView.noBranch', 'No branch')}
            </span>
          )}
        </div>
        <div className="flex h-8 items-center gap-2 px-2 text-[13px] text-muted-foreground">
          <GitPullRequest className="size-4 shrink-0" />
          {row.pr
            ? t('tmwk.ticketView.pr', 'PR #{{number}}', { number: row.pr.number })
            : t('tmwk.ticketView.noPr', 'No PR yet')}
        </div>
      </RailSection>
      <RailSection label={t('tmwk.ticketView.whereLabel', 'Where')}>
        <WhereText row={row} />
      </RailSection>
    </div>
  )
}
