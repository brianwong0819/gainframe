import { expect, type Page, test } from '@playwright/test'

// Dark mode's glow and translucent groups ("Dark glow" in
// docs/design-system.md): the glow sits behind the page and in the status bar
// strip, page groups let it through, and a sheet stays opaque so the page
// beneath never shows through it. Increase Contrast turns both off.
test.use({ colorScheme: 'dark', locale: 'zh-CN' })

// The alpha of a computed rgb() or rgba() colour.
const alpha = (color: string) => {
  const parts = color.match(/[\d.]+/g) ?? []
  return parts.length === 4 ? Number(parts[3]) : 1
}

async function readGround(page: Page) {
  return page.evaluate(() => ({
    glow: getComputedStyle(document.body, '::before').backgroundImage,
    strip: getComputedStyle(document.querySelector('.status-bar-fill') ?? document.body)
      .backgroundImage,
    group: getComputedStyle(document.querySelector('main ul') ?? document.body).backgroundColor,
  }))
}

async function openSheet(page: Page) {
  await page.locator('main li button').first().click()
  const panel = page.locator('.sheet-panel')
  await panel.waitFor()
  return panel.evaluate((element) => getComputedStyle(element).backgroundColor)
}

test('the glow shows behind translucent groups, and a sheet stays opaque', async ({ page }) => {
  await page.goto('/workout/exercises')
  await page.locator('main li button').first().waitFor()

  const ground = await readGround(page)
  expect(ground.glow).toContain('radial-gradient')
  expect(ground.strip).toContain('radial-gradient')
  expect(alpha(ground.group)).toBeLessThan(1)

  expect(alpha(await openSheet(page))).toBe(1)
})

test('Increase Contrast keeps the groups opaque and drops the glow', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' })
  await page.goto('/workout/exercises')
  await page.locator('main li button').first().waitFor()

  const ground = await readGround(page)
  expect(ground.glow).toBe('none')
  expect(ground.strip).not.toContain('radial-gradient')
  expect(alpha(ground.group)).toBe(1)
})
