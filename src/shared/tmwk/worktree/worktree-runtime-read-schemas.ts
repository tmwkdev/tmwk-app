import { z } from 'zod'

/** The `worktree.ps` fields tmwk reads; any agent row is a live agent. */
export const WorktreePsRow = z.object({
  worktreeId: z.string(),
  hostId: z.string().optional(),
  liveTerminalCount: z.number(),
  unverifiableTerminalCount: z.number().optional(),
  isActive: z.boolean().optional(),
  agents: z.array(z.unknown())
})
export const WorktreePs = z.object({ worktrees: z.array(WorktreePsRow), truncated: z.boolean() })
export type WorktreePsRows = z.infer<typeof WorktreePsRow>[]

/** The `workspaceCleanup.scan` fields tmwk reads. */
export const WorkspaceCleanupScan = z.object({
  candidates: z.array(
    z.object({
      worktreeId: z.string(),
      executionHostId: z.string().optional(),
      branch: z.string().optional(),
      blockers: z.array(z.string()),
      git: z
        .object({
          checkedAt: z.number().nullish(),
          upstreamAhead: z.number().nullish(),
          // The fields isWorkspaceCleanupHeadLanded reads.
          merge: z
            .object({
              headInDefaultBranch: z.boolean(),
              mergedReview: z.object({ containsHead: z.boolean() }).optional(),
              headInCoordinatorBranch: z.boolean().optional()
            })
            .optional(),
          atRiskLocalFiles: z
            .object({
              count: z.number(),
              samplePaths: z.array(z.string()),
              complete: z.boolean()
            })
            .nullish()
        })
        .optional()
    })
  )
})

export const WORKTREE_PS_LIMIT = 100_000
