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

function MainChatStatus({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function MainChatSurface({ tab }: { tab: MainChatTab }): React.JSX.Element {
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
    <div className="relative h-full min-h-0 bg-background">
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
  )
}

export default function MainChatView(): React.JSX.Element {
  const t = useTranslate()
  const session = useMainChatSession()
  if (session.status === 'preparing') {
    return (
      <MainChatStatus>
        {t('auto.components.main-chat.MainChatView.b52e7c9d18', 'Preparing your main chat...')}
      </MainChatStatus>
    )
  }
  return <MainChatSurface tab={session.tab} />
}
