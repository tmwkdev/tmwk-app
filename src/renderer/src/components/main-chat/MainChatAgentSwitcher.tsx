import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { MainSessionState } from '../../../../shared/tmwk/main-session-switch'
import type { MainChatTab } from './use-main-chat-session'

export function MainChatAgentSwitcher({
  tab,
  target,
  agents,
  switching,
  failure,
  onSwitch
}: {
  tab: MainChatTab
  target: RuntimeClientTarget
  agents: string[]
  switching: boolean
  failure: string | null
  onSwitch: (session: MainSessionState) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [agent, setAgent] = useState(tab.agentSessionAgent)
  const [submitting, setSubmitting] = useState(false)
  const pending = submitting || switching
  const [error, setError] = useState<string | null>(null)
  async function switchAgent(): Promise<void> {
    if (pending) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await callRuntimeRpc<MainSessionState>(target, 'tmwk.mainSession.switch', {
        agent,
        expectedSessionId: tab.entityId
      })
      onSwitch(result)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t('tmwk.mainChat.switchFailed', 'Cannot switch agents.')
      )
    }
    setSubmitting(false)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
      <span className="text-muted-foreground">{t('tmwk.mainChat.agent', 'Chat agent')}</span>
      <Select value={agent} onValueChange={setAgent} disabled={pending}>
        <SelectTrigger className="h-7 w-40" aria-label={t('tmwk.mainChat.agent', 'Chat agent')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[...new Set([tab.agentSessionAgent, ...agents])].map((id) => (
            <SelectItem key={id} value={id} disabled={!agents.includes(id)}>
              {isTuiAgent(id) ? getAgentLabel(id) : id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="xs"
        variant="outline"
        disabled={pending || agent === tab.agentSessionAgent}
        onClick={() => void switchAgent()}
      >
        {pending
          ? t('tmwk.mainChat.switching', 'Starting new chat…')
          : t('tmwk.mainChat.switch', 'Switch agent')}
      </Button>
      <span className="text-muted-foreground">
        {t('tmwk.mainChat.freshConversation', 'Starts fresh. Your previous chat stays in history.')}
      </span>
      {(error ?? failure) && (
        <p role="alert" className="w-full text-destructive">
          {error ?? failure}
        </p>
      )}
    </div>
  )
}
