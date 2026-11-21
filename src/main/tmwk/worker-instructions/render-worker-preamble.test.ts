import { describe, expect, it } from 'vitest'
import { renderWorkerPreamble } from './render-worker-preamble'

describe('renderWorkerPreamble', () => {
  it('keeps the markers Track code parses, with the task last', () => {
    const text = renderWorkerPreamble({
      taskId: 'task_1',
      dispatchId: 'ctx_1',
      taskSpec: 'Fix the bug.',
      coordinatorHandle: 'term_coord',
      workerHandle: 'term_worker',
      cli: 'orca'
    })

    expect(text.startsWith('You are working inside Orca, a multi-agent IDE.')).toBe(true)
    expect(text).toContain('Your task ID is: task_1')
    expect(text.endsWith('=== TASK ===\nFix the bug.')).toBe(true)
  })

  it('names the verify steps an owner runs before reporting', () => {
    const text = renderWorkerPreamble({
      taskId: 'task_1',
      dispatchId: 'ctx_1',
      taskSpec: 'Fix the bug.',
      coordinatorHandle: 'term_coord',
      workerHandle: 'term_worker',
      cli: 'orca'
    })

    expect(text).toContain(`then verify before you report:
  - \`pnpm check:changed\` (the full gate)
  - \`pnpm tc\`
  - \`/code-review\` (or your agent's equivalent) on the branch diff
  - \`/security-review\` only when the diff touches identity, telemetry, feedback or egress
Fix each finding or answer it in your report.`)
  })
})
