import React from 'react'
import { Check, CircleCheck, Cloud, Laptop, OctagonAlert, PanelLeft, Server } from 'lucide-react'
import { cn } from '@/lib/class-names'
import StatusIndicator from '@/components/sidebar/workspace-card/surface/StatusIndicator'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import SidebarNav from '@/components/sidebar/chrome/SidebarNav'
import SidebarToolbar from '@/components/sidebar/chrome/SidebarToolbar'
import type { Host, Session, SessionStatus, TicketState } from './m4-data'
import { HOST_LABEL } from './m4-data'

const STATE_STATUS = {
  decision: 'permission',
  stop: 'failed',
  result: 'done',
  running: 'working',
  ongoing: 'monitoring',
  paused: 'interrupted'
} as const

export function StateGlyph({ state }: { state: TicketState }): React.JSX.Element {
  if (state === 'stop') {
    return (
      <span
        className="inline-flex size-3 shrink-0 items-center justify-center text-destructive"
        aria-label="Stopped"
      >
        <OctagonAlert className="size-3" />
      </span>
    )
  }
  if (state === 'result') {
    return (
      <span
        className="inline-flex size-3 shrink-0 items-center justify-center text-emerald-500"
        aria-label="Ready to review"
      >
        <CircleCheck className="size-3" />
      </span>
    )
  }
  if (state === 'done') {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center text-muted-foreground">
        <Check className="size-3" />
      </span>
    )
  }
  return <StatusIndicator status={STATE_STATUS[state]} showTooltip={false} />
}

const SESSION_STATUS: Record<
  SessionStatus,
  React.ComponentProps<typeof StatusIndicator>['status']
> = {
  working: 'working',
  waiting: 'monitoring',
  done: 'done',
  failed: 'failed',
  idle: 'inactive',
  question: 'permission'
}

export function SessionGlyph({ status }: { status: SessionStatus }): React.JSX.Element {
  return <StatusIndicator status={SESSION_STATUS[status]} showTooltip={false} />
}

export function Agent({ agent, size = 13 }: { agent: Session['agent']; size?: number }) {
  return <AgentIcon agent={agent} size={size} className="shrink-0" />
}

const HOST_ICON = { laptop: Laptop, mbp: Server, ona: Cloud }

export function HostMark({
  host,
  label = false,
  className
}: {
  host: Host
  label?: boolean
  className?: string
}): React.JSX.Element {
  const Icon = HOST_ICON[host]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground',
        className
      )}
    >
      <Icon className="size-3" />
      {label && HOST_LABEL[host]}
    </span>
  )
}

export function SectionLabel({
  children,
  count,
  trailing
}: {
  children: React.ReactNode
  count?: number
  trailing?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-worktree-sidebar-foreground/70">
      <span>{children}</span>
      {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
      <span className="flex-1" />
      {trailing}
    </div>
  )
}

export function SessionRow({
  session,
  indent = 28,
  showModel = true
}: {
  session: Session
  indent?: number
  showModel?: boolean
}): React.JSX.Element {
  return (
    <div
      className="flex h-7 items-center gap-2 rounded-md pr-2 text-[13px] text-worktree-sidebar-foreground/85"
      style={{ paddingLeft: indent }}
    >
      <SessionGlyph status={session.status} />
      <Agent agent={session.agent} />
      <span className="min-w-0 flex-1 truncate">{session.role}</span>
      {showModel && (
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{session.model}</span>
      )}
      <span className="w-6 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
        {session.age}
      </span>
    </div>
  )
}

export function Row({
  active,
  className,
  children
}: {
  active?: boolean
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      data-current={active ? 'true' : undefined}
      className={cn(
        'rounded-md text-worktree-sidebar-foreground',
        active && 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

/** A 280-wide sidebar with the real Search row and the real bottom toolbar (Chat dock included unless `dock` is false). */
export function SidebarFrame({
  children,
  height = 760,
  width = 280,
  dock = true,
  nav = true,
  top
}: {
  children: React.ReactNode
  height?: number
  width?: number
  dock?: boolean
  nav?: boolean
  top?: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'm4-sidebar flex shrink-0 flex-col overflow-hidden border border-worktree-sidebar-border bg-worktree-sidebar text-worktree-sidebar-foreground',
        !dock && 'm4-no-dock'
      )}
      style={{ width, height }}
    >
      <div className="flex h-10 shrink-0 items-center justify-end border-b border-worktree-sidebar-border px-4 text-muted-foreground">
        <PanelLeft size={16} />
      </div>
      {top}
      {nav && <SidebarNav />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2">{children}</div>
      <SidebarToolbar workspaceBoardOpen={false} onWorkspaceBoardToggle={() => {}} />
    </div>
  )
}

export const m4Styles = `
#component-fixture-frame { padding:0; }
.m4-no-dock .mt-auto > div:first-child { display:none; }
.m4-board { padding:24px; background:var(--background); color:var(--foreground); }
.m4-board h1 { font-size:20px; font-weight:600; margin:0 0 4px; }
.m4-board p.m4-note { font-size:12px; color:var(--muted-foreground); margin:0 0 20px; max-width:1100px; }
.m4-columns { display:flex; gap:20px; align-items:flex-start; }
.m4-column { flex-shrink:0; }
.m4-column h2 { font-size:14px; font-weight:600; margin:0 0 4px; }
.m4-column p { font-size:12px; color:var(--muted-foreground); margin:0 0 12px; max-width:280px; min-height:32px; }
`

export function Style(): React.JSX.Element {
  return <style>{m4Styles}</style>
}

export function Board({
  title,
  note,
  children
}: {
  title: string
  note?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="m4-board">
      <Style />
      <h1>{title}</h1>
      {note && <p className="m4-note">{note}</p>}
      <div className="m4-columns">{children}</div>
    </div>
  )
}

export function Column({
  title,
  note,
  children
}: {
  title: string
  note?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="m4-column">
      <h2>{title}</h2>
      {note !== undefined && <p>{note}</p>}
      {children}
    </div>
  )
}
