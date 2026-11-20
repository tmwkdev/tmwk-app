import React from 'react'
import {
  ArrowUpRight,
  Github,
  Link2,
  OctagonAlert,
  Server,
  Sparkles,
  TicketPlus
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import { uiDateTimeFormat } from '@/i18n/ui-intl-formatters'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { cn } from '@/lib/class-names'
import { isTuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { AgentMessageSource } from '../../../../../shared/agent-session/journal/agent-session-message-source'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import type {
  TmwkChatEvent as TmwkChatEventPayload,
  TmwkTicketLine,
  TmwkTicketRequestEvent
} from '../../../../../shared/tmwk/tmwk-chat-event'
import { readTmwkChatEvent } from './tmwk-chat-event-message'

const TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

function time(at: string): string {
  const date = new Date(at)
  return Number.isNaN(date.getTime()) ? '' : uiDateTimeFormat(TIME_OPTIONS).format(date)
}

function agentName(agent: string): string {
  return isTuiAgent(agent) ? getAgentLabel(agent) : agent
}

/** "#431" for a GitHub issue or PR link; otherwise the text as pasted. */
function sourceLabel(source: string): { icon: LucideIcon; label: string } {
  const github = /github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/(\d+)/.exec(source)
  if (github) {
    return { icon: Github, label: `#${github[1]}` }
  }
  return { icon: /^#\d+$/.test(source) ? Github : Link2, label: source }
}

function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex h-5 max-w-60 items-center gap-1 rounded border border-border bg-background px-1.5 text-2xs text-muted-foreground">
      {children}
    </span>
  )
}

function TicketRequestEvent({ event }: { event: TmwkTicketRequestEvent }): React.JSX.Element {
  const t = useTranslate()
  const [title, ...rest] = event.words.trim().split('\n')
  const body = rest.join('\n').trim()
  const source = event.source ? sourceLabel(event.source) : null
  const runOn = event.runOnLabel ?? t('tmwk.newTicket.runOnAuto', 'Auto')
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-chat-foreground-faint">
        <span className="h-px flex-1 bg-border" />
        <TicketPlus className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">
          {t('tmwk.chatEvent.requested', 'You requested a new ticket')} · {time(event.requestedAt)}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="text-sm font-medium break-words text-foreground">{title}</div>
        {body ? (
          <p className="mt-1 text-xs leading-5 whitespace-pre-wrap break-words text-muted-foreground">
            {body}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {event.project ? (
            <Chip>
              <span className="size-1.5 shrink-0 rounded-[2px] bg-muted-foreground" />
              <span className="truncate">{event.project.name}</span>
            </Chip>
          ) : null}
          <Chip>
            <Sparkles className="size-3 shrink-0" />
            <span className="truncate">
              {t('tmwk.chatEvent.runOn', 'Run on {{host}}', { host: runOn })}
            </span>
          </Chip>
          {event.agent ? (
            <Chip>
              {isTuiAgent(event.agent) ? <AgentTypeIcon agentType={event.agent} size={11} /> : null}
              <span className="truncate">{agentName(event.agent)}</span>
            </Chip>
          ) : null}
          {source ? (
            <Chip>
              <source.icon className="size-3 shrink-0" />
              <span className="truncate">{source.label}</span>
            </Chip>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function lineText(line: TmwkTicketLine, t: ReturnType<typeof useTranslate>): string {
  if (line.kind === 'brief') {
    return t('tmwk.chatEvent.briefReady', 'Brief ready')
  }
  if (line.kind === 'delegated' && line.agent) {
    return t('tmwk.chatEvent.delegated', 'Delegated to {{agent}} on {{host}}', {
      agent: agentName(line.agent),
      host: line.host ?? t('tmwk.chatEvent.homeHost', 'the home host')
    })
  }
  return line.text
}

function TicketLines({
  lines,
  onOpenTicket
}: {
  lines: readonly TmwkTicketLine[]
  onOpenTicket?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex w-full flex-col gap-1.5">
      {lines.map((line, index) => {
        const failed = line.kind === 'failed'
        const Icon = failed ? OctagonAlert : Server
        return (
          <div
            key={`${line.kind}:${line.at}`}
            className="flex items-center gap-2 text-xs text-chat-foreground-faint"
          >
            <Icon className={cn('size-3.5 shrink-0', failed && 'text-destructive')} />
            <span className="min-w-0 flex-1">
              {lineText(line, t)} · {time(line.at)}
            </span>
            {onOpenTicket && index === lines.length - 1 ? (
              <button
                type="button"
                onClick={onOpenTicket}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-sm text-chat-foreground hover:text-chat-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('tmwk.chatEvent.openTicket', 'Open ticket')}
                <ArrowUpRight className="size-3" />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** A tmwk notice drawn as an event (D59): the New ticket request, or tmwk's own start lines. */
export function TmwkChatEvent({
  event,
  onOpenTicket
}: {
  event: TmwkChatEventPayload
  onOpenTicket?: (ticketId: string) => void
}): React.JSX.Element {
  return event.tmwk === 'ticket-request' ? (
    <TicketRequestEvent event={event} />
  ) : (
    <TicketLines
      lines={event.lines}
      onOpenTicket={onOpenTicket ? () => onOpenTicket(event.ticketId) : undefined}
    />
  )
}

/** Native chat's one tmwk branch: a tmwk event when the notice carries one, else Orca's card. */
export function TmwkChatEventOrCard({
  message,
  from,
  children
}: {
  message: Pick<NativeChatMessage, 'blocks'>
  from: AgentMessageSource
  children: React.ReactNode
}): React.JSX.Element {
  const event = readTmwkChatEvent(message, from)
  return event ? <TmwkChatEvent event={event} /> : <>{children}</>
}
