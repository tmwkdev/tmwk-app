import { z } from 'zod'
import type { TmwkRpc } from '../main-session/tmwk-runtime-rpc'

// Only what the install decision reads from `skills.planBundledOrca`.
const SkillPlan = z.object({
  planDigest: z.string(),
  skills: z.array(
    z.object({ ops: z.array(z.object({ observed: z.object({ kind: z.string() }) })) })
  )
})
type SkillPlan = z.infer<typeof SkillPlan>

async function plan(rpc: TmwkRpc, name: string): Promise<SkillPlan> {
  return SkillPlan.parse(await rpc('skills.planBundledOrca', { names: [name] }))
}

/** Orca installs a bundled skill only when a user names it; tmwk owners need `tmwk` wherever `orchestration` is installed. Never overwrites a copy. */
export async function ensureTmwkSkillInstalled(rpc: TmwkRpc): Promise<boolean> {
  const orchestration = await plan(rpc, 'orchestration')
  const hasOrchestration = orchestration.skills.some((skill) =>
    skill.ops.some((op) => op.observed.kind !== 'absent')
  )
  if (!hasOrchestration) {
    return false
  }
  const tmwk = await plan(rpc, 'tmwk')
  const ops = tmwk.skills.flatMap((skill) => skill.ops)
  if (ops.length === 0 || ops.some((op) => op.observed.kind !== 'absent')) {
    return false
  }
  await rpc('skills.executeBundledOrca', {
    planDigest: tmwk.planDigest,
    request: { names: ['tmwk'] }
  })
  return true
}
