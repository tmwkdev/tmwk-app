import { readFile } from 'node:fs/promises'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import {
  isMainSessionRecord,
  type MainSessionRecord
} from '../../../shared/tmwk/main-session-record'

export async function readMainSessionPin(path: string): Promise<MainSessionRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf-8'))
    return isMainSessionRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeMainSessionPin(path: string, record: MainSessionRecord): void {
  writeFileAtomically(path, `${JSON.stringify(record, null, 2)}\n`)
}
