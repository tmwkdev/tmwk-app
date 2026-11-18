import React, { Activity, useMemo } from 'react'
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
import { useMainChatSession, type MainChatTab } from './use-main-chat-session'
import { MainChatAgentSwitcher } from './MainChatAgentSwitcher'
import type {
  MainSessionPendingPhase,
  MainSessionState
} from '../../../../shared/tmwk/main-session-switch'

function MainChatStatus({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function MainChatSurface({
  tab,
  agents,
  pendingPhase,
  failure,
  onSwitch
}: {
  tab: MainChatTab
  agents: string[]
  pendingPhase: MainSessionPendingPhase | null
  failure: string | null
  onSwitch: (session: MainSessionState) => void
}): React.JSX.Element {
  const t = useTranslate()
  const owner = useAppStore((state) => structuredAgentSessionOwnerForTab(state, tab))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  if (!target) {
    return (
      <MainChatStatus>
        {t('auto.components.main-chat.MainChatView.3d9f1b6a40', 'Cannot reach the home host.')}
      </MainChatStatus>
    )
  }
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <MainChatAgentSwitcher
        key={tab.entityId}
        tab={tab}
        target={target}
        agents={agents}
        pendingPhase={pendingPhase}
        failure={failure}
        onSwitch={onSwitch}
      />
      <div className="relative min-h-0 flex-1">
        <NativeChatPaneLifetime key={`${owner}:${tab.entityId}`} isVisible>
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
      pendingPhase={session.pending?.phase ?? null}
      failure={session.lastFailure}
      onSwitch={session.setSession}
    />
  )
}
