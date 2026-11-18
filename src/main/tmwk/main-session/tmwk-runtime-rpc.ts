import { randomUUID } from 'node:crypto'
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

/** The same RPC every client uses, dispatched in process with the CLI's identity. */
export function createTmwkRpc(runtime: OrcaRuntimeService): TmwkRpc {
  let dispatcher: RpcDispatcher | null = null
  return async (method, params) => {
    dispatcher ??= new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS })
    const response = await dispatcher.dispatch(
      { id: randomUUID(), authToken: 'tmwk-main-home', method, params },
      { caller: { kind: 'local-cli' } }
    )
    if (!response.ok) {
      throw new TmwkRpcError(response.error.code, response.error.message)
    }
    return response.result
  }
}
