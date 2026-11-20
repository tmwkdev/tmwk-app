import React from 'react'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import { useAgentMenuObservation } from '@/components/agent/launch-menu/use-new-tab-agent-menu-rows'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

const FLOATING_LAUNCH = { workspace: { kind: 'floating' as const } }

/** The composer's agent field. A ticket only names the agent; the partner brief sets the rest. */
export function TicketAgentPicker({
  agent,
  onChange
}: {
  agent: TuiAgent | null
  onChange: (agent: TuiAgent) => void
}): React.JSX.Element {
  // Acquired while the sheet is open, so the field is ready before its menu opens.
  const observation = useAgentMenuObservation(FLOATING_LAUNCH, true, { kind: 'local' })
  const fallback = observation.preferences.defaultTuiAgent
  return (
    <AgentLaunchPicker
      model={observation.model}
      agent={agent ?? (fallback && fallback !== 'blank' ? fallback : null)}
      setupDisabled
      onPick={(picked) => onChange(picked)}
    />
  )
}
