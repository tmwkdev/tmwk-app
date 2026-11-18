import type { CommandHandler } from '../dispatch/dispatch'
import type { HandlerGroup } from '../dispatch/handler-group-manifest'

export const TMWK_HANDLER_GROUP: HandlerGroup = {
  name: 'tmwk',
  keys: [
    'tmwk preference set',
    'tmwk preference list',
    'tmwk preference remove',
    'tmwk note save',
    'tmwk history search',
    'tmwk history read'
  ],
  load: async (): Promise<Record<string, CommandHandler>> => ({
    ...(await import('./preference-handlers.js')).TMWK_PREFERENCE_HANDLERS,
    ...(await import('./note-handlers.js')).TMWK_NOTE_HANDLERS,
    ...(await import('./history-handlers.js')).TMWK_HISTORY_HANDLERS
  })
}
