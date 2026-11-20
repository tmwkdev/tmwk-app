import React from 'react'
import {
  ChevronDown,
  CircleDot,
  GitBranch,
  Github,
  Monitor,
  Paperclip,
  Search,
  Server,
  Settings2,
  Sparkles,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonKeyHint } from '@/components/ui/ButtonKeyHint'
import { SwitchIndicator } from '@/components/ui/switch'
import { cn } from '@/lib/class-names'
import { COMBOBOX_FIELD_SHELL } from '@/components/new-workspace/type-ahead/type-ahead-combobox-styles'
import { Agent } from './m4-kit'

export type SheetDraft = {
  description?: string
  project?: string
  projectFromFilter?: boolean
  source?: string
  runOnOpen?: boolean
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {children}
      {optional && <span className="text-muted-foreground/70"> [Optional]</span>}
    </label>
  )
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(COMBOBOX_FIELD_SHELL, 'text-sm', className)}>
      {children}
      <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
    </div>
  )
}

function ProjectMark() {
  return <span className="size-2 shrink-0 rounded-[2px] bg-muted-foreground" />
}

const RUN_ON = [
  { icon: Sparkles, label: 'Auto', detail: 'Picks a ready host', on: true },
  { icon: Monitor, label: 'Local Mac', detail: 'This computer' },
  { icon: Server, label: 'mbp', detail: 'SSH · tmwk-app here' }
]

function RunOnMenu() {
  return (
    <div className="absolute top-full right-0 z-10 mt-1 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
      {RUN_ON.map(({ icon: Icon, label, detail, on }) => (
        <div
          key={label}
          className={cn(
            'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
            on && 'bg-accent text-accent-foreground'
          )}
        >
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="flex-1">{label}</span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </div>
      ))}
    </div>
  )
}

function Description({ value, focused }: { value?: string; focused: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">What should get done?</label>
      <div
        className={cn(
          'relative min-h-[132px] rounded-md border border-input px-3 py-2 text-sm leading-6 shadow-xs dark:bg-input/30',
          focused && 'border-ring ring-[3px] ring-ring/50'
        )}
      >
        {value ? (
          <span className="whitespace-pre-wrap">{value}</span>
        ) : (
          <span className="text-muted-foreground">
            Describe the outcome. Paste links, errors or screenshots.
          </span>
        )}
        <Paperclip className="absolute right-2.5 bottom-2.5 size-3.5 text-muted-foreground" />
      </div>
      <div className="text-2xs text-muted-foreground">
        The only required field. Opens Chat to brief and delegate this request.
      </div>
    </div>
  )
}

function CreateFrom({ source }: { source?: string }) {
  return (
    <div className="space-y-1">
      <Label optional>Create from</Label>
      <div className={cn(COMBOBOX_FIELD_SHELL, 'text-sm')}>
        {source ? (
          <>
            <Github className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{source}</span>
            <X className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <>
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-muted-foreground">
              Search branches, issues and PRs, or paste a Jira URL
            </span>
          </>
        )}
      </div>
    </div>
  )
}

const EMPTY_DRAFT: SheetDraft = {}

/** The New ticket sheet: today's Create worktree modal with the description as the main field. */
export function NewTicketSheet({
  draft = EMPTY_DRAFT,
  className
}: {
  draft?: SheetDraft
  className?: string
}) {
  return (
    <div
      className={cn(
        'w-[512px] space-y-4 rounded-xl border border-border bg-background p-5 text-foreground shadow-lg',
        className
      )}
    >
      <div className="text-base font-semibold">New ticket</div>
      <Description value={draft.description} focused={!draft.runOnOpen} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Project</Label>
          <Field>
            <ProjectMark />
            {draft.project ?? 'tmwk-app'}
          </Field>
          {draft.projectFromFilter && (
            <div className="text-2xs text-muted-foreground">From your project filter</div>
          )}
        </div>
        <div className="relative space-y-1">
          <Label>Run on</Label>
          <Field className={cn(draft.runOnOpen && 'border-ring ring-[3px] ring-ring/50')}>
            <Sparkles className="size-3.5 text-muted-foreground" />
            Auto
          </Field>
          {draft.runOnOpen && <RunOnMenu />}
        </div>
      </div>
      <CreateFrom source={draft.source} />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label optional>Agent</Label>
          <Settings2 className="size-3 text-muted-foreground" />
        </div>
        <Field>
          <Agent agent="claude" size={14} />
          Claude Code
          <span className="text-xs text-muted-foreground">Your default</span>
        </Field>
      </div>
      <Button variant="ghost" size="sm" className="-ml-2 text-xs">
        Advanced
        <ChevronDown className="size-4" />
      </Button>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <SwitchIndicator checked={false} />
          Create more
        </span>
        <span className="flex-1" />
        <Button size="sm" className="text-xs" disabled={!draft.description}>
          Create ticket
          <ButtonKeyHint modifierLabel="⌘" />
        </Button>
      </div>
    </div>
  )
}

/** Today's Create worktree modal, drawn from the same parts for comparison. */
export function TodaySheet() {
  return (
    <div className="w-[512px] space-y-4 rounded-xl border border-border bg-background p-5 text-foreground shadow-lg">
      <div className="text-base font-semibold">New worktree</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Project</Label>
          <Field>
            <ProjectMark />
            tmwk-app
          </Field>
        </div>
        <div className="space-y-1">
          <Label>Run on</Label>
          <Field>
            <Monitor className="size-3.5 text-muted-foreground" />
            MacBook Pro
          </Field>
        </div>
      </div>
      <div className="space-y-1">
        <Label optional>Create From</Label>
        <div className="flex gap-3 px-1 pb-1 text-muted-foreground">
          <Sparkles className="size-3.5 text-foreground" />
          <Github className="size-3.5" />
          <CircleDot className="size-3.5" />
          <GitBranch className="size-3.5" />
          <span className="text-2xs font-medium">Aa</span>
        </div>
        <div className={cn(COMBOBOX_FIELD_SHELL, 'text-sm text-muted-foreground')}>
          Name a worktree, or search issues, PRs and branches
        </div>
      </div>
      <div className="space-y-1">
        <Label optional>Agent</Label>
        <Field>
          <Agent agent="claude" size={14} />
          Claude Code
        </Field>
      </div>
      <Button variant="ghost" size="sm" className="-ml-2 text-xs">
        Advanced
        <ChevronDown className="size-4" />
      </Button>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <SwitchIndicator checked={false} />
          Create more
        </span>
        <Button size="sm" className="text-xs">
          Create
          <ButtonKeyHint modifierLabel="⌘" />
        </Button>
      </div>
    </div>
  )
}
