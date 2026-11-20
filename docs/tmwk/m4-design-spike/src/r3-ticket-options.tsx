import React from 'react'
import {
  ArrowUpRight,
  CheckCheck,
  FolderTree,
  EyeOff,
  GripVertical,
  Pin,
  Repeat,
  SlidersHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FilterToggleRow } from '@/components/sidebar/worktree-list/controls/FilterToggleRow'
import { WorkspaceOptionsMenuItems } from '@/components/sidebar/worktree-list/controls/workspace-options-menu-items'
import { cn } from '@/lib/class-names'
import { MENU_SURFACE_CLASS } from '@/components/ui/menu-surface'
import type { TicketState } from './m4-data'
import { StateGlyph } from './m4-kit'
import { CUSTOM_STATUS_ORDER, STATUS_NAME } from './r3-status-list'

type Open = 'sort' | 'rows' | 'order'
const keepOpen = (event: Event) => event.preventDefault()

/** A menu drawn open in place, so several can sit side by side in one image. */
function OpenMenu({
  children,
  minHeight = 560
}: {
  children: React.ReactNode
  minHeight?: number
}) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  return (
    <div ref={setContainer} className="relative" style={{ minHeight }}>
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="bg-accent text-muted-foreground">
            <SlidersHorizontal className="size-3.5" strokeWidth={2.25} />
          </Button>
        </DropdownMenuTrigger>
        {container && (
          <DropdownMenuContent
            portalContainer={container}
            side="bottom"
            align="start"
            sideOffset={6}
            className="w-72 pb-2"
            onInteractOutside={keepOpen}
            onFocusOutside={keepOpen}
            onCloseAutoFocus={keepOpen}
          >
            {children}
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  )
}

export function TodayOptions() {
  return (
    <OpenMenu>
      <WorkspaceOptionsMenuItems />
    </OpenMenu>
  )
}

function ValueLabel({ label, value }: { label: string; value: string }) {
  return (
    <DropdownMenuSubTrigger>
      <span className="flex flex-1 items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{value}</span>
      </span>
    </DropdownMenuSubTrigger>
  )
}

/** A closed submenu row: label on the left, current value on the right. */
function ValueTrigger(props: { label: string; value: string }) {
  return (
    <DropdownMenuSub>
      <ValueLabel {...props} />
    </DropdownMenuSub>
  )
}

function Submenu({
  label,
  value,
  open,
  width = 'w-52',
  children
}: {
  label: string
  value: string
  open: boolean
  width?: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenuSub open={open}>
      <ValueLabel label={label} value={value} />
      <DropdownMenuSubContent
        className={width}
        onInteractOutside={keepOpen}
        onFocusOutside={keepOpen}
      >
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

const GROUPS = ['Attention', 'Status', 'Project', 'Host', 'None']

function GroupBy({ value }: { value: string }) {
  return (
    <div className="px-2 pt-0.5 pb-1">
      <ToggleGroup
        type="single"
        value={value}
        variant="outline"
        size="sm"
        className="h-6 w-full justify-stretch"
      >
        {GROUPS.map((group) => (
          <ToggleGroupItem
            key={group}
            value={group}
            className="h-6 grow basis-0 px-1 text-[10px] data-[state=on]:bg-foreground/10 data-[state=on]:font-semibold data-[state=on]:text-foreground"
          >
            {group}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

const ROW_FIELDS: [string, boolean][] = [
  ['Reason', true],
  ['Project', false],
  ['Host', false],
  ['Agent', false],
  ['Last activity', false],
  ['PR', false]
]

/** A stable popover, not a cascading submenu: drag targets and keyboard moves stay put. */
export function StatusOrderPopover() {
  const dragging: TicketState = 'stop'
  return (
    <div className={cn(MENU_SURFACE_CLASS, 'w-64 text-popover-foreground')}>
      <div className="px-2 pt-1 text-sm font-medium">Status order</div>
      <div className="flex items-start gap-1.5 px-2 pt-1 pb-2 text-2xs leading-4 text-muted-foreground">
        <Pin className="mt-0.5 size-3 shrink-0" />
        The Needs you count stays above every section, and decisions still reach you in Chat.
      </div>
      {CUSTOM_STATUS_ORDER.map((state) => (
        <React.Fragment key={state}>
          {state === dragging && <div className="mx-2 my-0.5 h-0.5 rounded bg-primary" />}
          <div
            className={cn(
              'flex h-7 items-center gap-2 rounded-[5px] px-2 text-xs',
              state === dragging &&
                'relative z-10 translate-x-1.5 border border-border bg-popover shadow-md',
              state === 'result' && 'ring-1 ring-ring'
            )}
          >
            <GripVertical className="size-3 text-muted-foreground" />
            <StateGlyph state={state} />
            <span className="flex-1">{STATUS_NAME[state]}</span>
            {state === 'result' && <span className="text-2xs text-muted-foreground">⌥↑↓</span>}
          </div>
        </React.Fragment>
      ))}
      <div className="mt-1 flex items-center border-t border-border px-1 pt-1.5">
        <span className="flex-1 px-1 text-2xs text-muted-foreground">Saved for you</span>
        <Button size="xs" variant="ghost">
          Reset to default
        </Button>
      </div>
    </div>
  )
}

export function TicketOptionsItems({
  groupBy = 'Attention',
  open
}: {
  groupBy?: string
  open?: Open
}) {
  return (
    <>
      <DropdownMenuLabel className="pb-0 text-sm text-foreground">Ticket options</DropdownMenuLabel>
      <DropdownMenuLabel>Show</DropdownMenuLabel>
      <ValueTrigger label="Hosts" value="All hosts" />
      <ValueTrigger label="Projects" value="All projects" />
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Group by</DropdownMenuLabel>
      <GroupBy value={groupBy} />
      {groupBy === 'Status' && (
        <DropdownMenuItem className={cn(open === 'order' && 'bg-accent')} onSelect={keepOpen}>
          <span className="flex flex-1 items-center justify-between gap-3">
            <span>Status order…</span>
            <span className="text-[11px] font-medium text-muted-foreground">Custom</span>
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <Submenu
        label="Sort within group"
        value={groupBy === 'Attention' ? 'Attention order' : 'Last activity'}
        open={open === 'sort'}
      >
        <DropdownMenuRadioGroup value={groupBy === 'Attention' ? 'attention' : 'activity'}>
          <DropdownMenuRadioItem value="attention" onSelect={keepOpen}>
            <span className="flex flex-col">
              Attention order
              <span className="text-[11px] text-muted-foreground">
                Decisions, then stops, then results
              </span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="activity">Last activity</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="newest">Newest</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </Submenu>
      <ValueTrigger label="Row density" value="Two lines" />
      <Submenu label="Show on rows" value="Reason" open={open === 'rows'} width="w-56">
        {ROW_FIELDS.map(([label, checked]) => (
          <DropdownMenuCheckboxItem key={label} checked={checked} onSelect={keepOpen}>
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-2xs leading-4 text-muted-foreground">
          Needs-you rows always keep their reason. A project still shows when two titles match, and
          a host when it explains a problem.
        </div>
      </Submenu>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold text-muted-foreground">Filters</span>
      </div>
      <FilterToggleRow
        icon={<CheckCheck className="size-3.5" />}
        label="Hide done"
        checked={false}
        onChange={() => {}}
      />
      <FilterToggleRow
        icon={<Repeat className="size-3.5" />}
        label="Hide ongoing"
        checked={false}
        onChange={() => {}}
      />
      <FilterToggleRow
        icon={<EyeOff className="size-3.5" />}
        label="Hide quiet"
        checked={false}
        onChange={() => {}}
      />
      <div className="px-2 pt-1 pb-1 text-2xs leading-4 text-muted-foreground">
        Filters never hide what needs you.
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={keepOpen}>
        <FolderTree className="size-3.5 text-muted-foreground" />
        Worktree view
        <ArrowUpRight className="ml-auto size-3 text-muted-foreground" />
      </DropdownMenuItem>
    </>
  )
}

export function TicketOptions(props: React.ComponentProps<typeof TicketOptionsItems>) {
  return (
    <div className="relative">
      <OpenMenu>
        <TicketOptionsItems {...props} />
      </OpenMenu>
      {props.open === 'order' && (
        <div className="absolute top-[196px] left-[296px]">
          <StatusOrderPopover />
        </div>
      )}
    </div>
  )
}
