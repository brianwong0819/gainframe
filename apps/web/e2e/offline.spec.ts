import { expect, test } from '@playwright/test'

import { createSiteServer } from './site-server.ts'

// The gym has no reliable signal, so the whole workout flow must work from the
// service worker's precache (ROADMAP M1-12): start offline, log three sets,
// finish, and find the workout in history. The test runs in Chinese, the
// language the static export renders.
test.use({ locale: 'zh-CN', serviceWorkers: 'allow' })

test('a workout logged offline is listed in history', async ({ page }) => {
  // A server of its own, which the test shuts down to go offline. Playwright's
  // offline emulation and request routing in WebKit also fail navigations the
  // service worker would answer (L-033).
  const server = createSiteServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  const origin = `http://localhost:${String(address.port)}`

  // The first visit installs the service worker; it controls the page only
  // after a reload, because it does not claim open clients.
  await page.goto(`${origin}/`)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  // No server: every request that reaches the network fails, as with no signal.
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await page.goto(`${origin}/workout`)
  await page.getByRole('button', { name: '开始训练' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()

  for (const [index, weightKg] of ['60', '62.5', '65'].entries()) {
    const n = String(index + 1)
    if (index > 0) {
      await page.getByRole('button', { name: '加一组' }).click()
      await page.getByRole('button', { name: `组 ${n}`, exact: true }).click()
    }
    const weight = page.getByRole('textbox', { name: `第 ${n} 组重量` })
    await weight.fill(weightKg)
    await weight.press('Enter')
    await expect(weight).toHaveValue(weightKg)
    const reps = page.getByRole('textbox', { name: `第 ${n} 组次数` })
    await reps.fill('8')
    await reps.press('Enter')
    await expect(reps).toHaveValue('8')
    await page
      .getByRole('main')
      .getByRole('button', { name: `完成第 ${n} 组` })
      .last()
      .click()
    await expect(page.getByRole('button', { name: `取消完成第 ${n} 组` })).toBeVisible()
    const rest = page.getByRole('dialog', { name: '组间休息' })
    if (await rest.isVisible()) {
      await rest.getByRole('button', { name: '开始下一组' }).click()
      await expect(rest).toBeHidden()
    }
  }

  await page.getByRole('button', { name: '结束训练' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#/)
  await page.getByRole('link', { name: '完成', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/?$/)

  await page.getByRole('link', { name: /训练历史/ }).click()
  await expect(page).toHaveURL(/\/workout\/history\/?$/)
  const card = page.getByRole('main').getByRole('listitem')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('杠铃卧推 · 3 组')
  await expect(card).toContainText('组数3')
  // 60 × 8 + 62.5 × 8 + 65 × 8
  await expect(card).toContainText('1,500 kg')

  // A cold start while still offline shows the same history from the device.
  await page.reload()
  await expect(page.getByRole('main').getByRole('listitem')).toContainText('杠铃卧推 · 3 组')
})
