import { randomUUID } from 'node:crypto'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../../shared/orchestration/orchestration-runtime-capabilities'
import { RpcDispatcher } from '../../runtime/rpc/dispatcher'
import { ALL_RPC_METHODS } from '../../runtime/rpc/methods/rpc-method-registry'
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
  let dispatcher: RpcDispatcher | null = null
  const getDispatcher = (): RpcDispatcher =>
    (dispatcher ??= new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS }))
  const request = (method: string, params: unknown) => ({
    id: randomUUID(),
    authToken: 'tmwk-main-home',
    method,
    params,
    // In process the client is always current; orchestration mutations refuse requests without it.
    ...(method.startsWith('orchestration.')
      ? { orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION }
      : {})
  })
  const rpc: TmwkRpc = async (method, params) => {
    const response = await getDispatcher().dispatch(request(method, params), {
      caller: { kind: 'local-cli' }
    })
    if (!response.ok) {
      throw new TmwkRpcError(response.error.code, response.error.message)
    }
    return response.result
  }
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
    getDispatcher()
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
