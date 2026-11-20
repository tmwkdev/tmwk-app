import { z } from 'zod'
import type { TicketRowModel } from '../../../shared/tmwk/ticket-overview/ticket-row-model'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

const WorktreeShow = z.object({
  worktree: z.object({
    linkedPR: z.number().nullable().optional(),
    git: z.object({ branch: z.string().nullable().optional() }).optional()
  })
})

export type TicketCode = Pick<TicketRowModel, 'branch' | 'pr'>

const NO_CODE: TicketCode = { branch: null, pr: null }

/**
 * The owner worktree's branch and linked PR, from Orca's `worktree.show` on this host. A paired
 * server's worktree, a folder workspace or a failed read gives none.
 */
export async function readTicketCode(rpc: TmwkRpc, worktreeId: string | null): Promise<TicketCode> {
  if (!worktreeId) {
    return NO_CODE
  }
  try {
    const { worktree } = WorktreeShow.parse(
      await rpc('worktree.show', { worktree: `id:${worktreeId}` })
    )
    const branch = (worktree.git?.branch ?? '').replace(/^refs\/heads\//, '')
    return {
      branch: branch || null,
      pr: worktree.linkedPR ? { number: worktree.linkedPR, url: null } : null
    }
  } catch (error) {
    console.error(`[tmwk] worktree read failed for ${worktreeId}:`, error)
    return NO_CODE
  }
}
