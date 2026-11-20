import { defineFixture } from '@/component-fixtures/component-fixture'
import { resetTicketOptions, store } from '../tickets/ticket-sidebar-seeds.test-fixture'
import {
  decisionView,
  doneView,
  failedAnswerView,
  gateAnsweredView,
  runningView,
  sentThroughChatView,
  TicketWindow
} from './ticket-view-seeds.test-fixture'

export const decision = defineFixture({
  width: 1248,
  store,
  setup: resetTicketOptions,
  render: () => <TicketWindow view={decisionView} width={1248} />
})

export const running = defineFixture({
  ...decision,
  render: () => <TicketWindow view={runningView} width={1248} />
})

export const done = defineFixture({
  ...decision,
  render: () => <TicketWindow view={doneView} width={1248} />
})

export const earlierExpanded = defineFixture({
  ...decision,
  interact: (frame) => {
    frame.querySelector<HTMLElement>('button[aria-expanded="false"]')?.click()
  }
})

// Under 900 px the rail folds into Details.
export const narrow = defineFixture({
  ...decision,
  width: 720,
  render: () => <TicketWindow view={decisionView} width={720} sidebar={false} />
})

export const narrowDetailsOpen = defineFixture({
  ...narrow,
  interact: (frame) => {
    frame.querySelector<HTMLElement>('[data-slot="collapsible-trigger"]')?.click()
  }
})

export const failedAnswer = defineFixture({
  ...decision,
  render: () => <TicketWindow view={failedAnswerView} width={1248} />
})

export const sentThroughChat = defineFixture({
  ...decision,
  render: () => <TicketWindow view={sentThroughChatView} width={1248} />
})

export const gateAnswered = defineFixture({
  ...decision,
  render: () => <TicketWindow view={gateAnsweredView} width={1248} />
})
