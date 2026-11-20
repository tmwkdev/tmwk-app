import React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { defineFixture } from '@/component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { TicketRowModel } from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TicketStatus } from '../../../../../shared/tmwk/ticket-overview/ticket-status'
import { StatusOrderPanel } from './StatusOrderPopover'
import { TicketOptionsMenuItems } from './TicketOptionsMenuItems'
import {
  DEFAULT_TICKET_OPTIONS,
  useTicketOptionsStore,
  type TicketOptions
} from './ticket-options-store'
import {
  busyRows,
  LAPTOP,
  noop,
  quietRows,
  SidebarFrame,
  store as sidebarStore,
  ticket,
  typicalRows
} from './ticket-fixture-seeds'

const repo = (id: string): Repo => ({
  id,
  path: `/Users/dev/${id}`,
  displayName: id,
  badgeColor: '#64748b',
  addedAt: 0
})

const store = {
  ...sidebarStore,
  repos: [repo('tmwk-app'), repo('website'), repo('demo')],
  sshTargetLabels: new Map([['mbp', 'MBP']])
}

const options = (patch: Partial<TicketOptions>): TicketOptions => ({
  ...DEFAULT_TICKET_OPTIONS,
  ...patch,
  showOnRows: { ...DEFAULT_TICKET_OPTIONS.showOnRows, ...patch.showOnRows }
})

const saved = (patch: Partial<TicketOptions>) => () => {
  useTicketOptionsStore.setState({ options: options(patch) })
}

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const ACTIVITY: Record<string, number> = {
  settings: 4,
  flaky: 9,
  auth: 3,
  ci: 60,
  deps: 2 * 24 * 60,
  store: 12,
  greet: 120,
  release: 22
}

const withActivity = (rows: TicketRowModel[]): TicketRowModel[] =>
  rows.map((row) => ({
    ...row,
    lastActivityAt: ACTIVITY[row.id] === undefined ? null : minutesAgo(ACTIVITY[row.id])
  }))

const withPrs = busyRows
  .filter((row) => !row.id.startsWith('readme') && row.id !== 'long' && row.id !== 'backoff')
  .map((row) => (row.id === 'auth' ? { ...row, pr: { number: 418, url: null } } : row))

const withDone: TicketRowModel[] = [
  ...typicalRows,
  ticket('pricing', 'Pricing page copy', 'website', 'done', 'Accepted', LAPTOP, 3),
  ticket('pin', 'Pin the Electron version', 'tmwk-app', 'done', 'Accepted', LAPTOP, 2),
  ticket('tour', 'Drop the old onboarding tour', 'tmwk-app', 'done', 'Accepted', LAPTOP, 1)
]

const CUSTOM_ORDER: TicketStatus[] = [
  'done',
  'blocked',
  'needsDecision',
  'readyForReview',
  'running',
  'waiting',
  'paused'
]

/** The real menu items drawn open in place, so a screenshot can hold them. */
function OpenOptionsMenu({ minHeight = 600 }: { minHeight?: number }): React.JSX.Element {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)
  return (
    <div ref={setContainer} className="relative" style={{ minHeight, width: 560 }}>
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
          >
            <TicketOptionsMenuItems onOpenStatusOrder={noop} onOpenWorktreeView={noop} />
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  )
}

const openSubmenu = (label: string) => async (frame: HTMLElement) => {
  const trigger = [
    ...frame.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')
  ].find((element) => element.textContent?.includes(label))
  trigger?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
  trigger?.click()
  await new Promise((resolve) => setTimeout(resolve, 150))
}

export const menu = defineFixture({
  width: 580,
  store,
  setup: saved({}),
  render: () => <OpenOptionsMenu />
})

export const sortSubmenu = defineFixture({
  ...menu,
  setup: saved({ groupBy: 'project', sortWithin: 'lastActivity' }),
  interact: openSubmenu('Sort within group')
})

export const showOnRowsSubmenu = defineFixture({
  ...menu,
  setup: saved({ showOnRows: { ...DEFAULT_TICKET_OPTIONS.showOnRows, pr: true } }),
  interact: openSubmenu('Show on rows')
})

export const groupByProject = defineFixture({
  width: 282,
  store,
  setup: saved({}),
  render: () => (
    <SidebarFrame
      rows={withPrs}
      options={options({
        groupBy: 'project',
        density: 'one-line',
        showOnRows: { ...DEFAULT_TICKET_OPTIONS.showOnRows, reason: false, pr: true }
      })}
    />
  )
})

export const groupByHost = defineFixture({
  ...groupByProject,
  render: () => (
    <SidebarFrame
      rows={withActivity(typicalRows)}
      options={options({
        groupBy: 'host',
        showOnRows: { ...DEFAULT_TICKET_OPTIONS.showOnRows, agent: true, lastActivity: true }
      })}
    />
  )
})

export const statusOrder = defineFixture({
  width: 860,
  store,
  setup: saved({ groupBy: 'status', statusOrder: CUSTOM_ORDER }),
  render: () => (
    <div className="relative">
      <OpenOptionsMenu minHeight={620} />
      <div className="absolute top-[196px] left-[296px] w-64 rounded-md border border-border bg-popover p-1 shadow-md">
        <StatusOrderPanel order={CUSTOM_ORDER} onChange={noop} onReset={noop} />
      </div>
    </div>
  ),
  interact: async (frame) => {
    frame.querySelector<HTMLElement>('[data-status-order-item="readyForReview"]')?.focus()
    // Mid-drag: Blocked lifted and pulled down half a row.
    const grip = frame.querySelector<HTMLElement>('[data-status-order-item="blocked"] span')
    const box = grip?.getBoundingClientRect()
    if (!grip || !box) {
      return
    }
    const at = (dy: number): PointerEventInit => ({
      bubbles: true,
      isPrimary: true,
      button: 0,
      pointerType: 'mouse',
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2 + dy
    })
    grip.dispatchEvent(new PointerEvent('pointerdown', at(0)))
    for (const dy of [6, 12, 18]) {
      await new Promise(requestAnimationFrame)
      document.dispatchEvent(new PointerEvent('pointermove', at(dy)))
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
})

export const customOrder = defineFixture({
  ...groupByProject,
  render: () => (
    <SidebarFrame
      rows={withDone}
      options={options({ groupBy: 'status', statusOrder: CUSTOM_ORDER })}
    />
  )
})

export const filteredEmpty = defineFixture({
  ...groupByProject,
  setup: saved({ hideDone: true, hideQuiet: true }),
  render: () => (
    <SidebarFrame
      rows={quietRows}
      height={360}
      options={options({ groupBy: 'status', hideDone: true, hideQuiet: true })}
    />
  )
})

export const projectFilterEmpty = defineFixture({
  ...groupByProject,
  render: () => (
    <SidebarFrame
      rows={[]}
      height={360}
      projectFilterLabel="website"
      options={options({ groupBy: 'project' })}
    />
  )
})
