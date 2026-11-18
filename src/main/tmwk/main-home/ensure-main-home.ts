import { z } from 'zod'
import { mkdir, readFile } from 'node:fs/promises'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import { getRepoMainWorktreeId } from '../../../shared/worktree/id'
import { renderPartnerPrompt } from '../partner-prompt/render-partner-prompt'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'
import { resolveMainHomePaths, type MainHomePaths } from './main-home-paths'
import { readMainPartnerPrompt } from './main-home-resources'

export type MainHome = {
  repoId: string
  worktreeId: string
  paths: MainHomePaths
  prompt: string
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

/** Writes the prompt transports only when their content differs; returns the files it wrote. */
export async function writeMainHomeTransports(
  paths: MainHomePaths,
  prompt: string
): Promise<string[]> {
  await mkdir(paths.mainHome, { recursive: true, mode: 0o700 })
  const written: string[] = []
  for (const target of [paths.claudeMd, paths.agentsMd]) {
    if ((await readOrNull(target)) !== prompt) {
      writeFileAtomically(target, prompt)
      written.push(target)
    }
  }
  return written
}

const addedRepoSchema = z.object({ repo: z.object({ id: z.string(), path: z.string() }) })

async function registerHiddenFolderWorkspace(
  rpc: TmwkRpc,
  path: string
): Promise<{ id: string; path: string }> {
  const added = await rpc('repo.add', { path, kind: 'folder', displayName: 'tmwk main' })
  const { repo } = addedRepoSchema.parse(added)
  await rpc('repo.setHidden', { repo: `id:${repo.id}`, hidden: true })
  return repo
}

/** Idempotent. Returns null (after logging) when the home cannot be prepared. */
export async function ensureTmwkMainHome(
  rpc: TmwkRpc,
  env: NodeJS.ProcessEnv = process.env
): Promise<MainHome | null> {
  const basePrompt = await readMainPartnerPrompt()
  if (basePrompt === null) {
    console.error('[tmwk] resources/tmwk/main-partner.md not found; main session not created')
    return null
  }
  const paths = resolveMainHomePaths(env)
  const prompt = renderPartnerPrompt(basePrompt)
  try {
    await writeMainHomeTransports(paths, prompt)
  } catch (error) {
    console.error('[tmwk] main home files not written:', error)
    return null
  }
  try {
    const repo = await registerHiddenFolderWorkspace(rpc, paths.mainHome)
    return { repoId: repo.id, worktreeId: getRepoMainWorktreeId(repo), paths, prompt }
  } catch (error) {
    console.error('[tmwk] main home workspace not registered:', error)
    return null
  }
}
