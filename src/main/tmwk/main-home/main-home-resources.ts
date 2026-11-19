import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-lifecycle/app-environment'

const RESOURCE_DIR_NAME = 'tmwk'
const PARTNER_PROMPT_FILE = 'main-partner.md'

function candidateResourceDirs(): string[] {
  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, RESOURCE_DIR_NAME))
  }
  const packaged = hasAppEnvironment() && getAppEnvironment().isPackaged()
  if (packaged) {
    candidates.push(join(getAppEnvironment().getAppPath(), RESOURCE_DIR_NAME))
    return candidates
  }
  for (const root of [
    hasAppEnvironment() ? getAppEnvironment().getAppPath() : null,
    process.cwd()
  ]) {
    if (root) {
      candidates.push(join(root, 'resources', RESOURCE_DIR_NAME))
    }
  }
  return candidates
}

export async function readTmwkResource(
  file: string,
  candidates: readonly string[] = candidateResourceDirs()
): Promise<string | null> {
  for (const dir of candidates) {
    try {
      return await readFile(join(dir, file), 'utf-8')
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

export function readMainPartnerPrompt(
  candidates: readonly string[] = candidateResourceDirs()
): Promise<string | null> {
  return readTmwkResource(PARTNER_PROMPT_FILE, candidates)
}
