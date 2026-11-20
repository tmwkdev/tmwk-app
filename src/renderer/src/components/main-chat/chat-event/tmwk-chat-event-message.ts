import { orchestrationMailNotice } from '../../../../../shared/agent-session/journal/agent-session-message-source'
import type { AgentMessageSource } from '../../../../../shared/agent-session/journal/agent-session-message-source'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import {
  parseTmwkChatEvent,
  TMWK_NOTICE_SENDER,
  type TmwkChatEvent
} from '../../../../../shared/tmwk/tmwk-chat-event'

const events = new WeakMap<NativeChatMessage['blocks'], TmwkChatEvent | null>()

/** The tmwk event a notice carries in its mail payload, or null for any other message. */
export function readTmwkChatEvent(
  message: Pick<NativeChatMessage, 'blocks'>,
  from: AgentMessageSource
): TmwkChatEvent | null {
  const mail = orchestrationMailNotice(from)?.messages
  const range =
    mail?.length === 1 && mail[0].from === TMWK_NOTICE_SENDER && mail[0].content?.payload
  const block = message.blocks.length === 1 ? message.blocks[0] : undefined
  if (!range || block?.type !== 'text') {
    return null
  }
  const cached = events.get(message.blocks)
  if (cached !== undefined) {
    return cached
  }
  const event = parseTmwkChatEvent(block.text.slice(range[0], range[1]))
  events.set(message.blocks, event)
  return event
}
