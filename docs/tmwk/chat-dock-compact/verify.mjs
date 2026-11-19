import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
const { url } = JSON.parse(await readFile('.cache/fixtures/server.json', 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const evidence = []
const out = 'docs/tmwk/chat-dock-compact/images'
async function render(name, theme = 'dark') {
  await page.goto(`${url}/fixtures.html?worker=1`)
  await page.waitForFunction(() => Boolean(window.__orcaComponentFixtureHost))
  await page.evaluate(
    ([id, theme]) => window.__orcaComponentFixtureHost.render(id, theme),
    [`main-chat/MainChatSidebarEntry:${name}`, theme]
  )
  await page.waitForFunction(() => document.documentElement.dataset.fixtureState === 'ready')
}
try {
  for (const theme of ['dark', 'light']) {
    await render('workspace', theme)
    const chat = page.getByRole('button', { name: 'Chat', exact: true })
    assert.equal(await chat.count(), 1)
    assert.equal(await chat.getAttribute('aria-current'), null)
    for (let i = 0; i < 80 && !(await chat.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab')
    }
    assert.ok(await chat.evaluate((el) => el === document.activeElement))
    await page
      .locator('#component-fixture-frame')
      .screenshot({ path: `${out}/keyboard-focus.${theme}.png`, animations: 'disabled' })
    evidence.push({
      theme,
      metrics: await chat.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const css = getComputedStyle(el)
        return {
          height: rect.height,
          width: rect.width,
          fontSize: css.fontSize,
          fontWeight: css.fontWeight,
          horizontalInset: css.paddingLeft,
          focusVisible: el.matches(':focus-visible')
        }
      })
    })
    await page.keyboard.press('Enter')
    assert.equal(await chat.getAttribute('aria-current'), 'page')
    assert.equal(await page.locator('[data-worktree-card-active]').count(), 0)
    const workspace = page
      .locator('[data-worktree-card-surface]')
      .filter({ hasText: 'chat-dock-compact' })
    await workspace.click()
    assert.equal(await chat.getAttribute('aria-current'), null)
    assert.equal(await workspace.getAttribute('data-worktree-card-active'), 'primary')
    const folder = page.locator('[data-worktree-card-surface]').filter({ hasText: 'Design notes' })
    await folder.click()
    assert.equal(await chat.getAttribute('aria-current'), null)
    assert.equal(await folder.getAttribute('data-worktree-card-active'), 'primary')
    await chat.focus()
    await page.keyboard.press('Space')
    assert.equal(await chat.getAttribute('aria-current'), 'page')
    assert.equal(await folder.getAttribute('data-worktree-card-active'), null)
    await page.keyboard.press('Tab')
    assert.ok(
      await page
        .getByRole('button', { name: 'Settings', exact: true })
        .evaluate((el) => el === document.activeElement)
    )
    await render('workspace', theme)
    await page.getByRole('button', { name: 'Chat', exact: true }).hover()
    await page
      .locator('#component-fixture-frame')
      .screenshot({ path: `${out}/hover.${theme}.png`, animations: 'disabled' })
    await render('short', theme)
    const shortChat = page.getByRole('button', { name: 'Chat', exact: true })
    const before = await shortChat.boundingBox()
    const scroller = page.locator('.worktree-sidebar-scrollbar').first()
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-worktree-card-surface]')].some((el) =>
        el.textContent?.includes('workspace-')
      )
    )
    const after = await shortChat.boundingBox()
    assert.deepEqual(after, before)
    await page
      .locator('#component-fixture-frame')
      .screenshot({ path: `${out}/short-scrolled.${theme}.png`, animations: 'disabled' })
    evidence.push({
      theme,
      scrolling: await scroller.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
      })),
      stationaryDock: true
    })
  }
  await render('collapsed')
  assert.equal(await page.getByRole('button', { name: 'Chat', exact: true }).count(), 0)
  await writeFile(
    '.cache/chat-dock-verification.json',
    JSON.stringify(
      {
        viewport: { width: 1280, height: 900 },
        evidence,
        keyboard: 'Tab, Enter, Space, Tab to toolbar passed',
        selection: 'Chat, worktree, folder passed',
        collapsed: 'Chat unmounted'
      },
      null,
      2
    )
  )
  console.log(await readFile('.cache/chat-dock-verification.json', 'utf8'))
} finally {
  await browser.close()
}
