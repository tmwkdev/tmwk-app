// tmwk Extend shim: the preamble text lives in src/main/tmwk/worker-instructions (docs/tmwk/fork-ownership.md).
import type { OrchestrationCliCommand } from './orchestration-cli-command'
import type { RuntimeAgentPromptWriteOptions } from '../../../terminal/input/agent-prompt-write-options'
import { ORCA_DISPATCH_PROMPT_LEAD_LINE } from '../../../../../shared/orchestration/workers/orca-dispatch-status-prompt'
import {
  renderWorkerPreamble,
  type WorkerPreambleInput
} from '../../../../tmwk/worker-instructions/render-worker-preamble'

export {
  CHAT_REDISPATCH_PARAGRAPH,
  TERMINAL_REDISPATCH_PARAGRAPH
} from '../../../../tmwk/worker-instructions/render-worker-preamble'

export type PreambleParams = Omit<WorkerPreambleInput, 'cli'> & {
  devMode?: boolean
  // Packaged WSL uses orca-ide; other hosts retain their existing launcher.
  cliCommand?: OrchestrationCliCommand
}

export function buildDispatchPreamble({ devMode, cliCommand, ...params }: PreambleParams): string {
  // Dev agents must reach the dev socket through orca-dev.
  const cli = devMode ? 'orca-dev' : (cliCommand ?? 'orca')
  return renderWorkerPreamble({ ...params, cli })
}

export type DispatchPreambleSendOptions = Pick<
  RuntimeAgentPromptWriteOptions,
  'leadLine' | 'acceptQueued' | 'observationTimeoutMs' | 'requestId' | 'inputKind' | 'beforeWrite'
>

export function dispatchPreambleSendOptions(requestId: string): DispatchPreambleSendOptions {
  // Why: a delayed provider hook must not revoke an accepted Dispatch.
  return {
    inputKind: 'orchestration',
    leadLine: ORCA_DISPATCH_PROMPT_LEAD_LINE,
    acceptQueued: true,
    observationTimeoutMs: 0,
    requestId
  }
}
