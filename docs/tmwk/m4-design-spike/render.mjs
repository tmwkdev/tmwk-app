// Renders the M4 mockups to PNG through the component-fixture server, then removes every temporary file.
// Usage: ORCA_BACKGROUND_LAUNCH=1 node docs/tmwk/m4-design-spike/render.mjs [name | M4Round3:name ...]
import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import {
  callFixtureServer,
  ensureFixtureServer,
  stopFixtureServer
} from '../../../config/scripts/component-fixtures/fixture-server-client.mjs'

const directory = import.meta.dirname
const root = path.resolve(directory, '../../..')
const target = path.join(root, 'src/renderer/src/components/main-chat')
const output = path.join(directory, 'images')
const FIXTURE_FILES = {
  'm4-fixtures.tsx': 'M4Spike.fixture.tsx',
  'r3-fixtures.tsx': 'M4Round3.fixture.tsx'
}
const sources = (await readdir(path.join(directory, 'src'))).filter((file) => /\.tsx?$/.test(file))

process.env.ORCA_BACKGROUND_LAUNCH = '1'
await stopFixtureServer()
await mkdir(output, { recursive: true })
const created = []
try {
  for (const file of sources) {
    const name = FIXTURE_FILES[file] ?? file
    const destination = path.join(target, name)
    await copyFile(path.join(directory, 'src', file), destination, 1)
    created.push(destination)
  }
  const server = await ensureFixtureServer()
  const requested = process.argv.slice(2)
  const listed = await callFixtureServer(server.url, 'list', {})
  const all = (listed.fixtures ?? listed.ids ?? listed)
    .map((entry) => (typeof entry === 'string' ? entry : entry.id))
    .filter((id) => /^main-chat\/M4(Spike|Round3):/.test(id))
  const ids = requested.length
    ? requested.map((name) => `main-chat/${name.includes(':') ? name : `M4Spike:${name}`}`)
    : all
  const result = await callFixtureServer(server.url, 'shot', {
    ids,
    theme: 'both',
    scale: 2,
    outDir: output
  })
  const failures = []
  for (let shot of result.results ?? []) {
    if (shot.pageErrors?.some((error) => !error.includes('404')) && !shot.error) {
      const retry = await callFixtureServer(server.url, 'shot', {
        ids: [shot.id],
        theme: shot.theme,
        scale: 2,
        outDir: output
      })
      shot = retry.results[0]
    }
    if (shot.error) {
      failures.push(shot)
      continue
    }
    const name = shot.id
      .split(':')[1]
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
    const file = path.join(output, `${name}-${shot.theme}.png`)
    await rename(shot.path, file)
    console.log(path.relative(root, file))
  }
  if (failures.length || result.error) {
    throw new Error(JSON.stringify({ failures, error: result.error }, null, 2))
  }
} finally {
  await Promise.all(created.map((file) => rm(file, { force: true })))
  await stopFixtureServer()
}
