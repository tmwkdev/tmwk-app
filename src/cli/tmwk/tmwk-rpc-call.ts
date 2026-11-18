import type { RuntimeClient } from '../runtime/client'
import { RuntimeClientError } from '../runtime/connection/types'
import type { RuntimeRpcSuccess } from '../../shared/remote-runtime/rpc/runtime-rpc-envelope'

const TMWK_CODE_PREFIX = /^(tmwk_[a-z_]+): ([\s\S]*)$/

// The runtime reports tmwk failures as runtime_error with the code leading the message.
export async function callTmwk<TResult>(
  client: Pick<RuntimeClient, 'call'>,
  method: string,
  params?: unknown
): Promise<RuntimeRpcSuccess<TResult>> {
  try {
    return await client.call<TResult>(method, params)
  } catch (error) {
    if (error instanceof RuntimeClientError) {
      if (error.code === 'method_not_found') {
        throw new RuntimeClientError(
          'incompatible_runtime',
          'This runtime has no tmwk commands yet. Update the server and try again.'
        )
      }
      const match = TMWK_CODE_PREFIX.exec(error.message)
      if (match) {
        throw new RuntimeClientError(match[1], match[2], error.data)
      }
    }
    throw error
  }
}
