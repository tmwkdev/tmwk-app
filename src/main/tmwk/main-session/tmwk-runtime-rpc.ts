import { randomUUID } from 'node:crypto'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../../shared/orchestration/orchestration-runtime-capabilities'
import { RpcDispatcher } from '../../runtime/rpc/dispatcher'
import { getTmwkRuntimeMethods } from './tmwk-runtime-method-catalog'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'

export type TmwkRpc = (method: string, params?: unknown) => Promise<unknown>

export class TmwkRpcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export type TmwkStreamFrame = (result: unknown) => void

export type TmwkRuntimeClient = {
  rpc: TmwkRpc
  /** Opens a streaming RPC; the returned function aborts it. `onClose` fires once if the stream fails (an error frame or a rejected dispatch), never on abort. */
  subscribe: (
    method: string,
    params: unknown,
    onFrame: TmwkStreamFrame,
    onClose?: () => void
  ) => () => void
}

const clients = new WeakMap<OrcaRuntimeService, TmwkRuntimeClient>()
const dispatchers = new WeakMap<OrcaRuntimeService, RpcDispatcher>()

function dispatcherFor(runtime: OrcaRuntimeService): RpcDispatcher {
  let dispatcher = dispatchers.get(runtime)
  if (!dispatcher) {
    dispatcher = new RpcDispatcher({ runtime, methods: getTmwkRuntimeMethods() })
    dispatchers.set(runtime, dispatcher)
  }
  return dispatcher
}

function tmwkRequest(method: string, params: unknown, agentSessionId?: string) {
  return {
    id: randomUUID(),
    authToken: 'tmwk-main-home',
    method,
    params,
    // In process the client is always current; orchestration mutations refuse requests without it.
    ...(method.startsWith('orchestration.')
      ? { orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION }
      : {}),
    ...(agentSessionId ? { orchestrationCompatibilityEvidence: { agentSessionId } } : {})
  }
}

async function dispatchTmwkRequest(
  runtime: OrcaRuntimeService,
  request: ReturnType<typeof tmwkRequest>
): Promise<unknown> {
  const response = await dispatcherFor(runtime).dispatch(request, {
    caller: { kind: 'local-cli' }
  })
  if (!response.ok) {
    throw new TmwkRpcError(response.error.code, response.error.message)
  }
  return response.result
}

/** The same RPC every client uses, dispatched in process with the CLI's identity; one client per runtime. */
export function createTmwkRuntimeClient(runtime: OrcaRuntimeService): TmwkRuntimeClient {
  let client = clients.get(runtime)
  if (!client) {
    client = buildTmwkRuntimeClient(runtime)
    clients.set(runtime, client)
  }
  return client
}

function buildTmwkRuntimeClient(runtime: OrcaRuntimeService): TmwkRuntimeClient {
  const request = (method: string, params: unknown) => tmwkRequest(method, params)
  const rpc: TmwkRpc = (method, params) => dispatchTmwkRequest(runtime, request(method, params))
  const subscribe: TmwkRuntimeClient['subscribe'] = (method, params, onFrame, onClose) => {
    const controller = new AbortController()
    let closed = false
    const close = (): void => {
      if (!closed && !controller.signal.aborted) {
        closed = true
        onClose?.()
      }
    }
    // The dispatch settles once the handler has registered; the stream lives on until abort.
    dispatcherFor(runtime)
      .dispatchStreamingObjects(
        request(method, params),
        (response) => {
          if (!response.ok) {
            console.error(`[tmwk] ${method} stream error: ${response.error.code}`)
            close()
            return
          }
          if (response.streaming && !closed) {
            onFrame(response.result)
          }
        },
        { caller: { kind: 'local-cli' }, signal: controller.signal }
      )
      .catch((error: unknown) => {
        console.error(`[tmwk] ${method} stream failed:`, error)
        close()
      })
    return () => controller.abort()
  }
  return { rpc, subscribe }
}

export function createTmwkRpc(runtime: OrcaRuntimeService): TmwkRpc {
  return createTmwkRuntimeClient(runtime).rpc
}

/**
 * Calls Orca as the given agent session, with the request-level evidence a session's own CLI
 * sends (W1 spike 2). tmwk uses it only for the pinned partner, to answer gates and questions on
 * Run `main` that Orca accepts only from its coordinator.
 */
export function createTmwkSessionRpc(runtime: OrcaRuntimeService, sessionId: string): TmwkRpc {
  return (method, params) => dispatchTmwkRequest(runtime, tmwkRequest(method, params, sessionId))
}

/** Calls a paired server (by name or environment id) as this Orca, the way `--environment` does. */
export function createTmwkServerRpc(
  runtime: OrcaRuntimeService,
  server: string,
  timeoutMs: number
): TmwkRpc {
  return (method, params) =>
    runtime.callOrchestrationWorkerServer(server, method, params ?? {}, timeoutMs)
}
