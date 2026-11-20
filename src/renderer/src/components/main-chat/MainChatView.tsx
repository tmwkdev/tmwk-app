import beaver from '../../../../../resources/tmwk-brand/beaver.png'
import React, { Activity, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { ActivityPortalContainer } from '@/components/ui/activity-portal-container'
import NativeChatView from '../native-chat/NativeChatView'
import { NativeChatComposerEditorOwner } from '../native-chat/composer/editor/native-chat-composer-editor-owner'
import { NativeChatHostOutageOwner } from '../native-chat/host-access/native-chat-host-outage-owner'
import { NativeChatPaneLifetime } from '../native-chat/pane/ownership/native-chat-pane-lifetime'
import type { MainChatTab } from './use-main-chat-host'
import { useMainChatSession } from './use-main-chat-session'
import { useMainChatPresence } from './use-main-chat-presence'
import { MainChatAgentSwitcher } from './MainChatAgentSwitcher'
import { MainChatContinuityStrip } from './MainChatContinuityStrip'
import { MainChatEarlierTranscript } from './MainChatEarlierTranscript'
import { NewTicketSheet } from './new-ticket/NewTicketSheet'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  MainSessionPendingPhase,
  MainSessionState
} from '../../../../shared/tmwk/main-session-switch'

function MainChatStatus({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-background px-4 text-sm text-muted-foreground">
      <img src={beaver} alt="" aria-hidden="true" className="size-32 object-contain" />
      <div>{children}</div>
    </div>
  )
}

function MainChatPresenceReporter({ target }: { target: RuntimeClientTarget }): null {
  useMainChatPresence(target)
  return null
}

function MainChatSurface({
  tab,
  agents,
  previousSessionId,
  pendingPhase,
  failure,
  onSwitch
}: {
  tab: MainChatTab
  previousSessionId: string | null
  agents: string[]
  pendingPhase: MainSessionPendingPhase | null
  failure: string | null
  onSwitch: (session: MainSessionState) => void
}): React.JSX.Element {
  const t = useTranslate()
  // Keyed by session, so a later switch or rollover returns to the live chat on its own.
  const [earlierFor, setEarlierFor] = useState<string | null>(null)
  const earlierShown = previousSessionId !== null && earlierFor === previousSessionId
  const owner = useAppStore((state) => structuredAgentSessionOwnerForTab(state, tab))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  if (!target || !owner) {
    return (
      <MainChatStatus>
        {t('auto.components.main-chat.MainChatView.3d9f1b6a40', 'Cannot reach the home host.')}
      </MainChatStatus>
    )
  }
  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <MainChatPresenceReporter target={target} />
        <NewTicketSheet target={target} />
        <MainChatAgentSwitcher
          key={tab.entityId}
          tab={tab}
          target={target}
          agents={agents}
          pendingPhase={pendingPhase}
          failure={failure}
          onSwitch={onSwitch}
        />
        {previousSessionId ? (
          <MainChatContinuityStrip
            showingEarlier={earlierShown}
            onToggle={() => setEarlierFor(earlierShown ? null : previousSessionId)}
          />
        ) : null}
        {earlierShown && previousSessionId ? (
          <MainChatEarlierTranscript
            key={previousSessionId}
            target={target}
            sessionId={previousSessionId}
          />
        ) : null}
        <div className={earlierShown ? 'hidden' : 'relative min-h-0 flex-1'}>
          <NativeChatPaneLifetime key={`${owner}:${tab.entityId}`} isVisible={!earlierShown}>
            <NativeChatHostOutageOwner target={target}>
              <NativeChatComposerEditorOwner>
                <ActivityPortalContainer visible>
                  <Activity mode="visible">
                    <NativeChatView
                      mode="structured"
                      tabId={tab.id}
                      groupId={tab.groupId}
                      sessionId={tab.entityId}
                      agent={tab.agentSessionAgent}
                      isVisible
                      isFocusedGroup
                      target={target}
                    />
                  </Activity>
                </ActivityPortalContainer>
              </NativeChatComposerEditorOwner>
            </NativeChatHostOutageOwner>
          </NativeChatPaneLifetime>
        </div>
      </div>
    </div>
  )
}

export default function MainChatView(): React.JSX.Element {
  const t = useTranslate()
  const session = useMainChatSession()
  if (!session.tab) {
    return (
      <MainChatStatus>
        {session.error ??
          t('auto.components.main-chat.MainChatView.b52e7c9d18', 'Preparing your chat...')}
      </MainChatStatus>
    )
  }
  return (
    <MainChatSurface
      tab={session.tab}
      agents={session.agents}
      previousSessionId={session.previousSessionId}
      pendingPhase={session.pending?.phase ?? null}
      failure={session.lastFailure}
      onSwitch={session.setSession}
    />
  )
}
