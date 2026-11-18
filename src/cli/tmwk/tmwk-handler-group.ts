import type { HandlerGroup } from '../dispatch/handler-group-manifest'

export const TMWK_HANDLER_GROUP: HandlerGroup = {
  name: 'tmwk',
  keys: ['tmwk preference list'],
  load: async () => (await import('./preference-handlers.js')).TMWK_PREFERENCE_HANDLERS
}
