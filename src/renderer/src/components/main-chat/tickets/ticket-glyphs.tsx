import React from 'react'
import { Check, CircleCheck, OctagonAlert } from 'lucide-react'
import StatusIndicator from '@/components/sidebar/workspace-card/surface/StatusIndicator'
import type {
  TicketSessionStatus,
  TicketState
} from '../../../../../shared/tmwk/ticket-overview/ticket-row-model'

type IndicatorStatus = React.ComponentProps<typeof StatusIndicator>['status']

const STATE_INDICATOR: Record<Exclude<TicketState, 'stop' | 'result' | 'done'>, IndicatorStatus> = {
  decision: 'permission',
  running: 'working',
  waiting: 'monitoring',
  paused: 'interrupted'
}

const SESSION_INDICATOR: Record<TicketSessionStatus, IndicatorStatus> = {
  working: 'working',
  waiting: 'monitoring',
  done: 'done',
  failed: 'failed',
  idle: 'inactive',
  question: 'permission'
}

// Stop and result differ in shape, not only hue, so they read apart without color.
export function TicketStateGlyph({ state }: { state: TicketState }): React.JSX.Element {
  if (state === 'stop') {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center text-destructive">
        <OctagonAlert className="size-3" aria-hidden="true" />
      </span>
    )
  }
  if (state === 'result') {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center text-workspace-status-review">
        <CircleCheck className="size-3" aria-hidden="true" />
      </span>
    )
  }
  if (state === 'done') {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center text-muted-foreground">
        <Check className="size-3" aria-hidden="true" />
      </span>
    )
  }
  return <StatusIndicator status={STATE_INDICATOR[state]} showTooltip={false} aria-hidden="true" />
}

export function TicketSessionGlyph({ status }: { status: TicketSessionStatus }): React.JSX.Element {
  return (
    <StatusIndicator status={SESSION_INDICATOR[status]} showTooltip={false} aria-hidden="true" />
  )
}
