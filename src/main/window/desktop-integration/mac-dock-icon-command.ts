import {
  execFile as execFileChildProcess,
  type ChildProcess,
  type ExecFileOptions
} from 'node:child_process'

export type ExecFile = (
  file: string,
  args: string[],
  optionsOrCallback: ExecFileOptions | ((error: Error | null) => void),
  callback?: (error: Error | null) => void
) => unknown

type MacDockIconChildProcess = Pick<ChildProcess, 'kill' | 'once'>

const MAC_DOCK_ICON_COMMAND_TIMEOUT_MS = 10_000
const MAC_DOCK_ICON_COMMAND_FALLBACK_MS = 1_000

export const defaultExecFile: ExecFile = (file, args, optionsOrCallback, callback) => {
  if (typeof optionsOrCallback === 'function') {
    return execFileChildProcess(file, args, optionsOrCallback)
  }
  return execFileChildProcess(file, args, optionsOrCallback, callback ?? (() => {}))
}

type BoundedMacDockIconCommandOptions = {
  args: string[]
  execFile: ExecFile
  file: string
  onError: (error: Error) => void
  options?: ExecFileOptions
  timeoutWarning: string
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function isMacDockIconChildProcess(value: unknown): value is MacDockIconChildProcess {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kill' in value &&
    typeof value.kill === 'function' &&
    'once' in value &&
    typeof value.once === 'function'
  )
}

export function runBoundedMacDockIconCommand({
  args,
  execFile,
  file,
  onError,
  options,
  timeoutWarning
}: BoundedMacDockIconCommandOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let childProcess: MacDockIconChildProcess | undefined
    let settled = false
    let forceFallback: NodeJS.Timeout | undefined

    const finish = (error: Error | null): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(fallback)
      if (forceFallback) {
        clearTimeout(forceFallback)
      }
      if (error) {
        onError(error)
      }
      resolve(!error)
    }

    const finishAfterFallback = (): void => {
      if (settled) {
        return
      }
      settled = true
      if (forceFallback) {
        clearTimeout(forceFallback)
      }
      console.warn(timeoutWarning)
      resolve(false)
    }

    const fallback = setTimeout(() => {
      if (settled) {
        return
      }
      if (!childProcess) {
        finishAfterFallback()
        return
      }
      // Hold the queue until an older icon process can no longer overwrite the result.
      childProcess.once('exit', finishAfterFallback)
      childProcess.once('close', finishAfterFallback)
      forceFallback = setTimeout(finishAfterFallback, MAC_DOCK_ICON_COMMAND_FALLBACK_MS)
      childProcess.kill()
    }, MAC_DOCK_ICON_COMMAND_TIMEOUT_MS + MAC_DOCK_ICON_COMMAND_FALLBACK_MS)

    try {
      const maybeChildProcess = execFile(
        file,
        args,
        {
          ...options,
          timeout: MAC_DOCK_ICON_COMMAND_TIMEOUT_MS
        },
        finish
      )
      if (isMacDockIconChildProcess(maybeChildProcess)) {
        childProcess = maybeChildProcess
      }
    } catch (error) {
      finish(toError(error))
    }
  })
}
