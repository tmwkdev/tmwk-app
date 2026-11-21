import type { DispatcherOptions } from '../../runtime/rpc/dispatcher'

let runtimeMethods: DispatcherOptions['methods'] | undefined

export function registerTmwkRuntimeMethods<T extends DispatcherOptions['methods']>(methods: T): T {
  runtimeMethods = methods
  return methods
}

export function getTmwkRuntimeMethods(): DispatcherOptions['methods'] {
  if (!runtimeMethods) {
    throw new Error('[tmwk] runtime RPC methods have not been registered')
  }
  return runtimeMethods
}
