import { BRIEF_RPC_METHODS } from './brief-rpc-methods'
import { CONTEXT_RPC_METHODS } from './context-rpc-methods'
import { HISTORY_RPC_METHODS } from './history-rpc-methods'
import { NOTE_RPC_METHODS } from './note-rpc-methods'
import { PRESENCE_RPC_METHODS } from './presence-rpc-methods'
import { PREFERENCE_RPC_METHODS } from './preference-rpc-methods'
import { SUMMARY_RPC_METHODS } from './summary-rpc-methods'
import { TICKET_RPC_METHODS } from './ticket-rpc-methods'
import { TICKET_REQUEST_RPC_METHODS } from './ticket-request-rpc-methods'
import { TICKET_VIEW_RPC_METHODS } from './ticket-view-rpc-methods'
import { TICKET_ANSWER_RPC_METHODS } from './ticket-answer-rpc-methods'

export const TMWK_RPC_METHODS = [
  ...PREFERENCE_RPC_METHODS,
  ...NOTE_RPC_METHODS,
  ...HISTORY_RPC_METHODS,
  ...BRIEF_RPC_METHODS,
  ...SUMMARY_RPC_METHODS,
  ...CONTEXT_RPC_METHODS,
  ...TICKET_RPC_METHODS,
  ...TICKET_REQUEST_RPC_METHODS,
  ...TICKET_VIEW_RPC_METHODS,
  ...TICKET_ANSWER_RPC_METHODS,
  ...PRESENCE_RPC_METHODS
]
