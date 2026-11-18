import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { CommandHandler } from '../dispatch/dispatch'
import { getOptionalStringFlag, getRepeatedStringFlag } from '../arguments/flags'
import { readTextOrFileFlag } from '../arguments/command-body-input'
import { printResult } from '../output/command-result-output'
import { callTmwk } from './tmwk-rpc-call'

type BriefResult = { briefId: string; text: string; partial: boolean }

export const TMWK_BRIEF_HANDLERS: Record<string, CommandHandler> = {
  'tmwk brief': async ({ flags, client, cwd, json }) => {
    const goal = await readTextOrFileFlag(flags, cwd, 'goal', true)
    const words = getOptionalStringFlag(flags, 'words')
    const project = getOptionalStringFlag(flags, 'project')
    const out = getOptionalStringFlag(flags, 'out')
    const evidence = getRepeatedStringFlag(flags, 'evidence')
    const response = await callTmwk<BriefResult>(client, 'tmwk.brief', {
      goal,
      ...(words === undefined ? {} : { words }),
      ...(project === undefined ? {} : { project }),
      ...(evidence.length === 0 ? {} : { evidence })
    })
    if (out === undefined) {
      printResult(response, json, (result) => result.text)
      return
    }
    const path = isAbsolute(out) ? out : resolve(cwd, out)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, response.result.text, 'utf8')
    printResult(response, json, () => path)
  }
}
