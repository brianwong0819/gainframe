import { expect, test } from '@playwright/test'

// Today leads with the workout to do now, then the week and the latest
// records (design review, 2026-11-16). The test runs in Chinese, the language
// the static export renders.
test.use({ locale: 'zh-CN' })

test('Today starts a workout and then shows the week it counts for', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('还没有完成的训练。')).toBeVisible()
  // The protein card leads; the workout is one row below it, not a tall card.
  const protein = page.locator('section').filter({ hasText: '蛋白质' }).first()
  const start = page.getByRole('button', { name: '开始训练' })
  const [proteinBox, startBox] = [await protein.boundingBox(), await start.boundingBox()]
  expect(proteinBox).not.toBeNull()
  expect(startBox).not.toBeNull()
  expect(proteinBox?.y ?? 0).toBeLessThan(startBox?.y ?? 0)
  await start.click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)

  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.locator('.set-panel').getByRole('button', { name: '完成第 1 组' }).click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  await page.getByRole('button', { name: '结束训练' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#.+$/)

  await page.getByRole('link', { name: '今天', exact: true }).click()
  const week = page.locator('section').filter({ has: page.getByRole('heading', { name: '本周' }) })
  await expect(week).toContainText('1 次 · 1 组')
  await expect(page.getByText('还没有完成的训练。')).toBeHidden()
  // With nothing in progress and no plan, the start button is back.
  await expect(page.getByRole('button', { name: '开始训练' })).toBeVisible()
})
