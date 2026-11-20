import { defineFixture } from '@/component-fixtures/component-fixture'
import {
  busyRows,
  LAST_REPORT,
  quietRows,
  resetTicketOptions,
  SidebarFrame,
  store,
  unreachableRows
} from './ticket-sidebar-seeds.test-fixture'

export const typical = defineFixture({
  width: 282,
  store,
  setup: resetTicketOptions,
  render: () => <SidebarFrame />
})

export const selected = defineFixture({
  ...typical,
  render: () => <SidebarFrame selectedId="settings" />,
  interact: (frame) => {
    frame
      .querySelector<HTMLElement>('[data-ticket-item="ticket:settings"] [data-ticket-disclosure]')
      ?.click()
  }
})

export const busy = defineFixture({ ...typical, render: () => <SidebarFrame rows={busyRows} /> })

export const nothingNeedsYou = defineFixture({
  ...typical,
  render: () => <SidebarFrame rows={quietRows} />
})

export const hostUnreachable = defineFixture({
  ...typical,
  render: () => <SidebarFrame rows={unreachableRows} />
})

export const homeHostUnreachable = defineFixture({
  ...typical,
  render: () => <SidebarFrame hostUnreachable={{ label: 'MBP', lastReportAt: LAST_REPORT }} />
})

export const empty = defineFixture({ ...typical, render: () => <SidebarFrame rows={[]} /> })
