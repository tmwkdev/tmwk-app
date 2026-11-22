import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../../../../../orca-runtime'
import type { OrchestrationDb } from '../../../../../../orchestration/db/orchestration-db'
import { monitorWorkerSetup } from './worker-placement-topology'

describe('monitorWorkerSetup setup terminal close', () => {
  it('closes the setup terminal when setup exits 0', async () => {
    const closeTerminal = vi.fn().mockResolvedValue(undefined)
    const updateWorkerSetupEvidence = vi.fn().mockReturnValue({ changed: false })
    monitorWorkerSetup({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: monitorWorkerSetup only calls these two runtime methods on this path.
      runtime: {
        waitForSetupTerminalCompletion: vi.fn().mockResolvedValue({ exitCode: 0 }),
        closeTerminal
      } as unknown as OrcaRuntimeService,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: with changed=false the monitor reads no other db method.
      db: { updateWorkerSetupEvidence } as unknown as OrchestrationDb,
      runId: 'run_1',
      dispatchId: 'dispatch_1',
      setupReceipt: {
        requested: 'run',
        effective: 'run',
        source: 'repo',
        hookFound: true,
        startupPolicy: 'start-immediately',
        state: 'running'
      },
      effects: [
        { kind: 'terminal', role: 'agent', id: 'term_agent' },
        { kind: 'terminal', role: 'setup', id: 'term_setup' }
      ]
    })
    await vi.waitFor(() => expect(updateWorkerSetupEvidence).toHaveBeenCalled())
    expect(closeTerminal.mock.calls).toEqual([['term_setup']])
  })
})
