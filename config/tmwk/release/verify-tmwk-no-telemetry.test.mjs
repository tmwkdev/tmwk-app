import { createPackage } from '@electron/asar'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyTmwkNoTelemetry } from './verify-tmwk-no-telemetry.mjs'

const scratchDirs = []

async function distWithMainJs(mainJs) {
  const scratch = await mkdtemp(join(tmpdir(), 'tmwk-no-telemetry-'))
  scratchDirs.push(scratch)
  const app = join(scratch, 'app')
  await mkdir(join(app, 'out/main'), { recursive: true })
  await writeFile(join(app, 'out/main/index.js'), mainJs)
  const dist = join(scratch, 'dist')
  await mkdir(join(dist, 'mac-arm64/tmwk.app/Contents/Resources'), { recursive: true })
  await createPackage(app, join(dist, 'mac-arm64/tmwk.app/Contents/Resources/app.asar'))
  return dist
}

describe('verify-tmwk-no-telemetry', () => {
  afterEach(async () => {
    await Promise.all(scratchDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('passes a build with no key and no Orca endpoint', async () => {
    const dist = await distWithMainJs('const BUILD_IDENTITY = "stable"; const WRITE_KEY = null;')
    expect(verifyTmwkNoTelemetry(dist)).toEqual([])
  })

  it('fails a build with an Orca PostHog key', async () => {
    const dist = await distWithMainJs(
      'const BUILD_IDENTITY = "stable"; const WRITE_KEY = "phc_abc123XYZ";'
    )
    expect(verifyTmwkNoTelemetry(dist)).toEqual([
      `${join(dist, 'mac-arm64/tmwk.app/Contents/Resources/app.asar')}: a PostHog write key (phc_…) is baked in`
    ])
  })

  it('fails a build with the Orca diagnostics URL', async () => {
    const dist = await distWithMainJs('var e="https://orca.dev/diagnostics/token";')
    expect(verifyTmwkNoTelemetry(dist)).toEqual([
      `${join(dist, 'mac-arm64/tmwk.app/Contents/Resources/app.asar')}: forbidden endpoint orca.dev/diagnostics is baked in`
    ])
  })
})
