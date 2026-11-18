import { isAbsolute, join } from 'node:path'
import { getAppEnvironment } from '../../../shared/app-lifecycle/app-environment'

export type MainHomePaths = {
  root: string
  mainHome: string
  claudeMd: string
  agentsMd: string
  sessionRecord: string
}

function resolveTmwkRoot(env: NodeJS.ProcessEnv): string {
  if (env.TMWK_HOME && isAbsolute(env.TMWK_HOME)) {
    return env.TMWK_HOME
  }
  const app = getAppEnvironment()
  // Dev userData is per worktree, so a dev instance never touches the real ~/.tmwk.
  if (!app.isPackaged() || env.ORCA_E2E_USER_DATA_DIR) {
    return join(app.getPath('userData'), 'tmwk')
  }
  const home = (process.platform === 'win32' ? env.USERPROFILE : env.HOME) || app.getPath('home')
  return join(home, '.tmwk')
}

export function resolveMainHomePaths(env: NodeJS.ProcessEnv = process.env): MainHomePaths {
  const root = resolveTmwkRoot(env)
  const mainHome = join(root, 'main')
  return {
    root,
    mainHome,
    claudeMd: join(mainHome, 'CLAUDE.md'),
    agentsMd: join(mainHome, 'AGENTS.md'),
    sessionRecord: join(root, 'main-session.json')
  }
}
