import type { OrcaRuntimeService } from '../../runtime/orca-runtime'

const operations = new WeakMap<OrcaRuntimeService, Promise<unknown>>()

export function runMainSessionOperation<T>(
  runtime: OrcaRuntimeService,
  operation: () => Promise<T>
): Promise<T> {
  const previous = operations.get(runtime) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(operation)
  operations.set(runtime, next)
  return next
}
