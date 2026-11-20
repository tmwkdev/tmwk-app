import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
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
const originalNames = [
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
const cNames = [
  'cCompareChat',
  'cCompareProject',
  'cPreviewChat',
  'cPreviewProject',
  'cCenteredChat',
  'cCenteredProject',
  'cCompactChat',
  'cCompactProject',
  'cContextChat',
  'cContextProject',
  'cStates'
]
const names = process.argv.includes('--c-only') ? cNames : [...originalNames, ...cNames]
process.env.ORCA_BACKGROUND_LAUNCH = '1'
await stopFixtureServer()
await mkdir(output, { recursive: true })
const createdFiles = []
try {
  for (const file of ['sidebar-preview.tsx', 'conversation-dock-study.tsx']) {
    const target = path.join(path.dirname(temporaryFixture), file)
    await copyFile(path.join(directory, file), target, 1)
    createdFiles.push(target)
  }
  await writeFile(
    temporaryFixture,
    `export { ${originalNames.join(', ')} } from './sidebar-preview'\nexport { ${cNames.join(', ')} } from './conversation-dock-study'\n`,
    { flag: 'wx' }
  )
  createdFiles.push(temporaryFixture)
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
      .replace(/^c(Compare|Preview|Centered|Compact|Context|States)/, 'c-$1')
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
  await Promise.all(createdFiles.map((file) => rm(file, { force: true })))
  await stopFixtureServer()
}
