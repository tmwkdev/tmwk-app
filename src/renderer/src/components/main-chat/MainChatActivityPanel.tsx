import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import { useEffect, useMemo, useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { useTranslate } from '@/i18n/use-translate'
import { formatUiRelativeTime } from '@/i18n/relative-time-format'
import { Button } from '@/components/ui/button'
import { activateWorktreeAgentPane } from '@/components/sidebar/workspace-card/activity/use-worktree-agent-activation'
import { getAgentPaneExecutionHost } from '@/store/slices/agent-status/pane-authority/agent-pane-execution-host'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { formatAgentTypeLabel } from '../../../../shared/agent-status/presentation/agent-type-label'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  RUNNING_STATUSES,
  type TmwkTicket,
  type TmwkTicketStatus
} from '../../../../shared/tmwk/tmwk-tickets'
import { useMainChatTickets } from './use-main-chat-tickets'

const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000
const AGE_TICK_MS = 60_000

type OwnerPane = {
  worktreeId: string
  tabId: string
  paneKey: string
  agentLabel: string | null
  updatedAt: number
}

function useOwnerPanes(executionHostId: ExecutionHostId): Map<string, OwnerPane> {
  const statusByPaneKey = useAppStore((state) => state.agentStatusByPaneKey)
  const tabsByWorktree = useAppStore((state) => state.tabsByWorktree)
  return useMemo(
    () => collectOwnerPanes(statusByPaneKey, tabsByWorktree, executionHostId),
    [statusByPaneKey, tabsByWorktree, executionHostId]
  )
}

function collectOwnerPanes(
  statusByPaneKey: AppState['agentStatusByPaneKey'],
  tabsByWorktree: AppState['tabsByWorktree'],
  executionHostId: ExecutionHostId
): Map<string, OwnerPane> {
  const worktreeByTabId = new Map<string, string>()
  for (const [id, tabs] of Object.entries(tabsByWorktree)) {
    for (const tab of tabs ?? []) {
      worktreeByTabId.set(tab.id, id)
    }
  }
  const state = useAppStore.getState()
  const panes = new Map<string, OwnerPane>()
  for (const [paneKey, entry] of statusByPaneKey) {
    const parsed = parsePaneKey(paneKey)
    if (!entry.terminalHandle || !parsed) {
      continue
    }
    if (getAgentPaneExecutionHost(state, paneKey, entry) !== executionHostId) {
      continue
    }
    const worktreeId = entry.worktreeId ?? worktreeByTabId.get(parsed.tabId)
    const existing = panes.get(entry.terminalHandle)
    if (worktreeId && (!existing || entry.updatedAt >= existing.updatedAt)) {
      panes.set(entry.terminalHandle, {
        worktreeId,
        tabId: parsed.tabId,
        paneKey,
        agentLabel: entry.agentType ? formatAgentTypeLabel(entry.agentType) : null,
        updatedAt: entry.updatedAt
      })
    }
  }
  return panes
}

function isFinishedStatus(ticket: TmwkTicket): boolean {
  return ticket.status === 'completed' || ticket.status === 'failed'
}

function ticketTime(ticket: TmwkTicket): number {
  return Date.parse(
    ticket.completedAt ?? (isFinishedStatus(ticket) ? ticket.lastSeenAt : ticket.firstSeenAt)
  )
}

function shortHandle(handle: string): string {
  return handle.length > 14 ? `${handle.slice(0, 12)}…` : handle
}

function TicketRow({
  ticket,
  pane,
  statusLabel,
  now,
  executionHostId
}: {
  ticket: TmwkTicket
  pane: OwnerPane | undefined
  statusLabel: string
  now: number
  executionHostId: ExecutionHostId
}): React.JSX.Element {
  const owner = pane?.agentLabel ?? (ticket.owner ? shortHandle(ticket.owner) : null)
  const age = formatUiRelativeTime(ticketTime(ticket) - now)
  const body = (
    <>
      <span className="truncate text-sm text-foreground">{ticket.title}</span>
      <span className="truncate text-xs text-muted-foreground">
        {[owner, statusLabel, age].filter(Boolean).join(' · ')}
      </span>
    </>
  )
  const className = 'flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left'
  return pane ? (
    <button
      type="button"
      className={`${className} hover:bg-accent`}
      onClick={() =>
        activateWorktreeAgentPane(pane.worktreeId, pane.tabId, pane.paneKey, executionHostId)
      }
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function MainChatActivityPanel({
  target,
  tabId,
  executionHostId
}: {
  target: RuntimeClientTarget
  tabId: string
  executionHostId: ExecutionHostId
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const { tickets, failed, refetch } = useMainChatTickets(target, tabId)
  const panes = useOwnerPanes(executionHostId)
  const [now, setNow] = useState(() => Date.now())
  useEffect(
    () =>
      installWindowVisibilityInterval({ run: () => setNow(Date.now()), intervalMs: AGE_TICK_MS }),
    []
  )
  const needsYou = tickets.filter((ticket) => ticket.needsMe !== null)
  const running = tickets.filter(
    (ticket) =>
      ticket.needsMe === null &&
      (RUNNING_STATUSES.includes(ticket.status) || ticket.status === 'blocked')
  )
  const cutoff = now - FINISHED_WINDOW_MS
  const finished = tickets.filter(
    (ticket) => ticket.needsMe === null && isFinishedStatus(ticket) && ticketTime(ticket) >= cutoff
  )
  const statusLabels: Record<TmwkTicketStatus, string> = {
    pending: t('tmwk.mainChat.statusPending', 'Pending'),
    ready: t('tmwk.mainChat.statusReady', 'Ready'),
    dispatched: t('tmwk.mainChat.statusRunning', 'Running'),
    completed: t('tmwk.mainChat.statusCompleted', 'Completed'),
    failed: t('tmwk.mainChat.statusFailed', 'Failed'),
    blocked: t('tmwk.mainChat.statusBlocked', 'Blocked')
  }
  const groups = [
    { id: 'needs', title: t('tmwk.mainChat.groupNeedsYou', 'Needs you'), rows: needsYou },
    { id: 'running', title: t('tmwk.mainChat.groupRunning', 'Running'), rows: running },
    {
      id: 'finished',
      title: t('tmwk.mainChat.groupFinished', 'Finished in the last 24 hours'),
      rows: finished
    }
  ].filter((group) => group.rows.length > 0)
  const toggleLabel = open
    ? t('tmwk.mainChat.activityHide', 'Hide activity')
    : t('tmwk.mainChat.activityShow', 'Show activity')
  const toggle = (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={toggleLabel}
      aria-expanded={open}
      title={toggleLabel}
      onClick={() => {
        if (!open) {
          refetch()
        }
        setOpen(!open)
      }}
    >
      {open ? <PanelRightClose /> : <PanelRightOpen />}
    </Button>
  )
  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-1 border-l border-border py-2">
        {toggle}
        {needsYou.length > 0 ? (
          <span className="text-xs font-medium text-foreground">
            <span aria-hidden>{needsYou.length}</span>
            <span className="sr-only">
              {t('tmwk.mainChat.needsYouCount', '{{count}} need you', { count: needsYou.length })}
            </span>
          </span>
        ) : null}
      </div>
    )
  }
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('tmwk.mainChat.activityTitle', 'Activity')}
        </span>
        {toggle}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-1 py-2">
        {failed ? (
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            {t('tmwk.mainChat.refreshFailed', 'Could not refresh. Showing the last known state.')}
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t('tmwk.mainChat.nothingRunning', 'Nothing running.')}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="mb-3">
              <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.title}</h3>
              {group.rows.map((ticket) => (
                <TicketRow
                  key={ticket.taskId}
                  ticket={ticket}
                  pane={ticket.owner ? panes.get(ticket.owner) : undefined}
                  statusLabel={statusLabels[ticket.status]}
                  now={now}
                  executionHostId={executionHostId}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </aside>
  )
}
