import React, { useState } from 'react'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPaletteSessionAge } from '@/components/cmd-j/palette-session-age'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { useNow } from '@/lib/window-activity/use-now'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  TmwkFailureKind,
  TmwkHealthFailure,
  TmwkHealthView
} from '../../../../../shared/tmwk/tmwk-health'
import { TicketStateGlyph } from '../tickets/ticket-glyphs'
import { useTmwkHealth } from './use-tmwk-health'

const RECENT_FAILURE_MS = 24 * 60 * 60 * 1000

function failureLabels(t: Translate): Record<TmwkFailureKind, string> {
  return {
    rollover: t('tmwk.health.kindRollover', 'Rollover failed'),
    summary: t('tmwk.health.kindSummary', 'Working summary failed'),
    'main-session': t('tmwk.health.kindMainSession', 'Main chat failed'),
    'ticket-refresh': t('tmwk.health.kindTicketRefresh', 'Ticket refresh failed')
  }
}

export function hasRecentFailure(view: TmwkHealthView | null, now: number): boolean {
  const newest = view?.failures[0]
  return newest !== undefined && now - Date.parse(newest.at) < RECENT_FAILURE_MS
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-3 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">{children}</div>
  )
}

function FailureRow({
  failure,
  now
}: {
  failure: TmwkHealthFailure
  now: number
}): React.JSX.Element {
  const t = useTranslate()
  const age = formatPaletteSessionAge(Date.parse(failure.at), now, t)
  return (
    <li className="flex gap-2 px-3 py-1.5">
      <span className="pt-[3px]">
        <TicketStateGlyph state="stop" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate">
            {failureLabels(t)[failure.kind]}
            {failure.repeats > 1 && (
              <span className="text-muted-foreground"> ×{failure.repeats}</span>
            )}
          </span>
          {age && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t('tmwk.health.ago', '{{age}} ago', { age })}
            </span>
          )}
        </div>
        <div className="line-clamp-2 text-xs break-words text-muted-foreground">
          {failure.message}
        </div>
      </div>
    </li>
  )
}

function StatRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1 text-[13px]">
      <span>{label}</span>
      <span className="text-right text-xs text-muted-foreground tabular-nums">{value}</span>
    </div>
  )
}

/** What tmwk recorded on this machine: recent failures, rollovers and ticket outcomes. */
export function TmwkHealthPanel({
  view,
  failed
}: {
  view: TmwkHealthView | null
  failed: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(60_000)
  if (!view) {
    return (
      <div className="px-3 py-4 text-[13px] text-muted-foreground">
        {failed
          ? t('tmwk.health.unavailable', 'Cannot read health from the home host.')
          : t('tmwk.health.loading', 'Loading…')}
      </div>
    )
  }
  const { rollovers, tickets } = view
  const rolloverCount = rollovers.stored + rollovers.fallback + rollovers.stale
  const rolloverNotes = [
    rollovers.fallback > 0 &&
      t('tmwk.health.rolloverFallback', '{{count}} with a fallback summary', {
        count: rollovers.fallback
      }),
    rollovers.stale > 0 &&
      t('tmwk.health.rolloverStale', '{{count}} with an old summary', { count: rollovers.stale })
  ].filter(Boolean)
  return (
    <div className="pb-1">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
        <span className="text-[13px] font-medium">{t('tmwk.health.title', 'Health')}</span>
        <span className="text-xs text-muted-foreground">
          {t('tmwk.health.window', 'Last {{days}} days', { days: view.windowDays })}
        </span>
      </div>
      <SectionLabel>{t('tmwk.health.failures', 'Failures')}</SectionLabel>
      {view.failures.length === 0 ? (
        <div className="px-3 py-1 text-[13px] text-muted-foreground">
          {t('tmwk.health.noFailures', 'No failures.')}
        </div>
      ) : (
        <ul>
          {view.failures.map((failure) => (
            <FailureRow key={`${failure.kind}:${failure.at}`} failure={failure} now={now} />
          ))}
        </ul>
      )}
      <SectionLabel>{t('tmwk.health.activity', 'Activity')}</SectionLabel>
      <StatRow
        label={t('tmwk.health.rollovers', 'Rollovers')}
        value={[String(rolloverCount), ...rolloverNotes].join(' · ')}
      />
      <StatRow
        label={t('tmwk.health.tickets', 'Tickets')}
        value={t(
          'tmwk.health.ticketOutcomes',
          '{{completed}} done · {{failed}} failed · {{lost}} lost · {{open}} running',
          tickets
        )}
      />
      <div className="mt-2 border-t border-border px-3 pt-2 pb-1 text-xs text-muted-foreground">
        {failed
          ? t('tmwk.health.stale', 'Cannot reach the home host; showing the last read.')
          : t('tmwk.health.localOnly', 'Recorded on this computer only. Nothing is sent.')}
      </div>
    </div>
  )
}

export function TmwkHealthPopover({
  view,
  failed,
  open,
  onOpenChange
}: {
  view: TmwkHealthView | null
  failed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(60_000)
  const recent = hasRecentFailure(view, now)
  const label = recent
    ? t('tmwk.health.buttonRecent', 'Health: a failure in the last day')
    : t('tmwk.health.button', 'Health')
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="relative" aria-label={label}>
              <Activity className="size-3.5" />
              {recent && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive"
                />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
        <TmwkHealthPanel view={view} failed={failed} />
      </PopoverContent>
    </Popover>
  )
}

/** The Chat header's Health button, reading `tmwk.health` from the home host. */
export function TmwkHealthButton({ target }: { target: RuntimeClientTarget }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { view, failed } = useTmwkHealth(target, open)
  return <TmwkHealthPopover view={view} failed={failed} open={open} onOpenChange={setOpen} />
}
