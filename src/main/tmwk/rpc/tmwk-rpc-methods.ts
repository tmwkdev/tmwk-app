import { HISTORY_RPC_METHODS } from './history-rpc-methods'
import { NOTE_RPC_METHODS } from './note-rpc-methods'
import { PREFERENCE_RPC_METHODS } from './preference-rpc-methods'

export const TMWK_RPC_METHODS = [
  ...PREFERENCE_RPC_METHODS,
  ...NOTE_RPC_METHODS,
  ...HISTORY_RPC_METHODS
]
