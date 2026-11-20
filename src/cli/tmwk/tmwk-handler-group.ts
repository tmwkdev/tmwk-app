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
    'tmwk history read',
    'tmwk brief',
    'tmwk summary write',
    'tmwk summary show',
    'tmwk context',
    'tmwk main rollover',
    'tmwk tickets',
    'tmwk tickets accept',
    'tmwk ticket start',
    'tmwk ticket retry',
    'tmwk ticket show',
    'tmwk ticket ask',
    'tmwk away'
  ],
  load: async (): Promise<Record<string, CommandHandler>> => ({
    ...(await import('./preference-handlers.js')).TMWK_PREFERENCE_HANDLERS,
    ...(await import('./note-handlers.js')).TMWK_NOTE_HANDLERS,
    ...(await import('./history-handlers.js')).TMWK_HISTORY_HANDLERS,
    ...(await import('./brief-handler.js')).TMWK_BRIEF_HANDLERS,
    ...(await import('./summary-handlers.js')).TMWK_SUMMARY_HANDLERS,
    ...(await import('./context-handler.js')).TMWK_CONTEXT_HANDLERS,
    ...(await import('./main-session-handlers.js')).TMWK_MAIN_SESSION_HANDLERS,
    ...(await import('./ticket-handlers.js')).TMWK_TICKET_HANDLERS,
    ...(await import('./ticket-start-handler.js')).TMWK_TICKET_START_HANDLERS,
    ...(await import('./away-handler.js')).TMWK_AWAY_HANDLERS
  })
}
