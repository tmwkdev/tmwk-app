import type { HandlerGroup } from '../dispatch/handler-group-manifest'

export const TMWK_HANDLER_GROUP: HandlerGroup = {
  name: 'tmwk',
  keys: ['tmwk preference set', 'tmwk preference list', 'tmwk preference remove'],
  load: async () => (await import('./preference-handlers.js')).TMWK_PREFERENCE_HANDLERS
}
