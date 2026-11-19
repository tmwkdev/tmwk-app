import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import {
  ensureFixtureServer,
  callFixtureServer,
  stopFixtureServer
} from '../../../config/scripts/component-fixtures/fixture-server-client.mjs'

const directory = import.meta.dirname
const root = path.resolve(directory, '../../..')
const temporaryFixture = path.join(
  root,
  'src/renderer/src/components/main-chat/ChatNavPreview.fixture.tsx'
)
const output = path.join(directory, 'images')
const names = [
  'compareChat',
  'compareProject',
  'todayChat',
  'todayProject',
  'aChat',
  'aProject',
  'bChat',
  'bProject',
  'cChat',
  'cProject',
  'bTools'
]
process.env.ORCA_BACKGROUND_LAUNCH = '1'
await stopFixtureServer()
await mkdir(output, { recursive: true })
await copyFile(path.join(directory, 'sidebar-preview.tsx'), temporaryFixture, 1)
try {
  const server = await ensureFixtureServer()
  const result = await callFixtureServer(server.url, 'shot', {
    ids: names.map((name) => `main-chat/ChatNavPreview:${name}`),
    theme: 'both',
    scale: 2,
    outDir: output
  })
  for (let shot of result.results ?? []) {
    if (shot.pageErrors?.length && !shot.error) {
      const retry = await callFixtureServer(server.url, 'shot', {
        ids: [shot.id],
        theme: shot.theme,
        scale: 2,
        outDir: output
      })
      shot = retry.results[0]
    }
    if (shot.error || shot.pageErrors?.length) {
      throw new Error(JSON.stringify(shot))
    }
    const name = shot.id
      .split(':')[1]
      .replace(/(Chat|Project)$/, '-$1')
      .toLowerCase()
    const target = path.join(output, `${name}-${shot.theme}.png`)
    await rename(shot.path, target)
    console.log(path.relative(root, target))
  }
  if (result.error || result.results?.length !== names.length * 2) {
    throw new Error(JSON.stringify(result))
  }
} finally {
  await rm(temporaryFixture, { force: true })
  await stopFixtureServer()
}
