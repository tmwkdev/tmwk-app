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
})
