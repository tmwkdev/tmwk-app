import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { AgentReadEntry } from '../../../../shared/agent-conversations/agent-conversation-contracts'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'

type HistorySource = { entries?: AgentReadEntry[]; limited?: boolean }
type KeyedEntry = { id: string; entry: AgentReadEntry }

export function MainChatEarlierTranscript({
  target,
  sessionId
}: {
  target: RuntimeClientTarget
  sessionId: string
}): React.JSX.Element {
  const t = useTranslate()
  const [source, setSource] = useState<{ limited: boolean; entries: KeyedEntry[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    setFailed(false)
    void callRuntimeRpc<HistorySource>(target, 'tmwk.historyRead', {
      sourceId: `session:orca:${sessionId}`
    })
      .then((result) => {
        if (active) {
          // A closed session's transcript never changes, so its position is a stable id.
          setSource({
            limited: result.limited === true,
            entries: (result.entries ?? []).map((entry, position) => ({
              id: `${sessionId}:${position}`,
              entry
            }))
          })
        }
      })
      .catch((error: unknown) => {
        console.error('tmwk earlier conversation read failed', error)
        if (active) {
          setFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [target, sessionId, attempt])
  useEffect(() => {
    const node = scrollRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [source])
  if (failed || source === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        {failed
          ? t('tmwk.mainChat.earlierUnavailable', 'Cannot load the earlier conversation.')
          : t('tmwk.mainChat.earlierLoading', 'Loading the earlier conversation...')}
        {failed ? (
          <button
            type="button"
            className="text-xs underline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('tmwk.mainChat.earlierRetry', 'Retry')}
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek bg-background px-4 py-3"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 text-sm">
        {source.limited ? (
          <p className="text-xs text-muted-foreground">
            {t('tmwk.mainChat.earlierShortened', 'Shortened: not the whole conversation.')}
          </p>
        ) : null}
        {source.entries.map(({ id, entry }) => (
          <div key={id} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {entryLabel(entry, t)}
            </span>
            {entry.kind === 'tool' ? null : (
              <p className="whitespace-pre-wrap break-words text-foreground">{entry.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function entryLabel(entry: AgentReadEntry, t: ReturnType<typeof useTranslate>): string {
  if (entry.kind === 'message') {
    if (entry.role === 'user') {
      return t('tmwk.mainChat.roleUser', 'You')
    }
    if (entry.role === 'assistant') {
      return t('tmwk.mainChat.roleAssistant', 'Assistant')
    }
    return entry.role
  }
  if (entry.kind === 'tool') {
    return t('tmwk.mainChat.roleTool', 'Tool: {{name}}', { name: entry.name })
  }
  if (entry.kind === 'error') {
    return t('tmwk.mainChat.roleError', 'Error')
  }
  return entry.kind === 'approval'
    ? t('tmwk.mainChat.roleApproval', 'Approval')
    : t('tmwk.mainChat.roleQuestion', 'Question')
}
