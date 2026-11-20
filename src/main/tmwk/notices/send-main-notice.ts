import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../shared/agent-session/identity/orca-session-address-prefix'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { TmwkRpcError, type TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { TMWK_NOTICE_SENDER, type TmwkChatEvent } from '../../../shared/tmwk/tmwk-chat-event'

/** `payload` makes the card render as a tmwk event (D59); the `[tmwk]` fallback drops it. */
export type MainNotice = { subject: string; body: string; payload?: TmwkChatEvent }
export type MainNoticeResult = { via: 'mail' | 'send' }

const HistoryFence = z.object({ page: z.object({ fence: z.number().int().positive().optional() }) })

let fallbackLogged = false

function isFallbackEligible(error: unknown): boolean {
  return (
    error instanceof TmwkRpcError &&
    error.code !== 'recipient_delivery_held' &&
    error.code !== 'recipient_delivery_unknown'
  )
}

/** Mail card first (D17); a user-role `[tmwk]` message when mail is refused; held or unknown delivery is not retried. */
export async function sendMainNotice(
  rpc: TmwkRpc,
  sessionId: string,
  notice: MainNotice
): Promise<MainNoticeResult> {
  try {
    await rpc('orchestration.send', {
      to: `${ORCA_SESSION_ADDRESS_PREFIX}${sessionId}`,
      from: TMWK_NOTICE_SENDER,
      type: 'status',
      subject: notice.subject,
      body: notice.body,
      ...(notice.payload ? { payload: JSON.stringify(notice.payload) } : {})
    })
    return { via: 'mail' }
  } catch (error) {
    if (!isFallbackEligible(error)) {
      throw error
    }
    if (!fallbackLogged) {
      fallbackLogged = true
      console.error('[tmwk] notice mail refused, using a user-role message:', error)
    }
  }
  await sendAsUserMessage(rpc, sessionId, notice)
  return { via: 'send' }
}

async function sendAsUserMessage(
  rpc: TmwkRpc,
  sessionId: string,
  notice: MainNotice
): Promise<void> {
  const { page } = HistoryFence.parse(
    await rpc('agentSession.history', { sessionId, direction: 'tail', limit: 1 })
  )
  if (page.fence === undefined) {
    throw new Error('[tmwk] main session history returned no runtime fence; cannot send a notice')
  }
  const text = `[tmwk] ${notice.subject}${notice.body ? `\n\n${notice.body}` : ''}`
  await rpc(
    'agentSession.send',
    structuredAgentSessionMessageSendMutation({
      sessionId,
      clientOperationId: `${Date.now()}-${randomUUID().replaceAll('-', '')}`,
      expectedRuntimeFence: page.fence,
      body: structuredAgentSessionSendBody(text, [])
    })
  )
}
