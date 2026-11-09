import { expect, test } from '@playwright/test'

// iOS may end the home-screen app between sets, so every tap is stored at once
// (ROADMAP M1-05 Verify: a page reload loses nothing). The test runs in Chinese,
// the language the static export renders.
test.use({ locale: 'zh-CN' })

test('a logged set and an open workout survive a reload', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()

  const heavier = page.getByRole('button', { name: '第 1 组加重量' })
  await heavier.click()
  await heavier.click()
  await page.getByRole('button', { name: '第 1 组加次数' }).click()
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()

  // A done set opens its details; its kind and the exercise note are kept too.
  await page.getByRole('button', { name: '组 1', exact: true }).click()
  const warmup = page.getByRole('dialog').getByRole('button', { name: '热身' })
  await warmup.click()
  await expect(warmup).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click()
  await page.getByRole('main').getByRole('button', { name: '备注' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('座椅第 4 格')
  await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
  // The card shows the note once it is read back from the database; leaving the
  // page before then could abandon the write.
  await expect(page.getByRole('main').getByText('座椅第 4 格')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'horizontal scroll').toBe(0)

  // Launching on Today goes straight back to the workout in progress.
  await page.goto('/')
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByRole('heading', { name: '训练中' })).toBeVisible()
  const row = page.getByRole('button', { name: '组 1', exact: true })
  await expect(row).toContainText('5')
  await expect(row).toContainText('9')
  await expect(row).toContainText('热')
  await expect(page.getByText('座椅第 4 格')).toBeVisible()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
})
