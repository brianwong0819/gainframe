import { expect, test } from '@playwright/test'

// iOS may end the home-screen app between sets, so every tap is stored at once
// (ROADMAP M1-05 Verify: a page reload loses nothing). The test runs in Chinese,
// the language the static export renders.
test.use({ locale: 'zh-CN' })

test('a logged set and an open workout survive a reload', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()

  // Typing a weight (a comma is a decimal point), then two steps of 2.5 kg.
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.click()
  await page.keyboard.type('57,5')
  await weight.press('Enter')
  await expect(weight).toHaveValue('57.5')
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
  await expect(page.getByRole('paragraph').filter({ hasText: '座椅第 4 格' })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'horizontal scroll').toBe(0)

  // Launching on Today goes straight back to the workout in progress.
  await page.goto('/')
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await expect(page.getByRole('heading', { name: '训练中' })).toBeVisible()
  const row = page.getByRole('button', { name: '组 1', exact: true })
  await expect(row).toContainText('62.5')
  await expect(row).toContainText('9')
  await expect(row).toContainText('热')
  await expect(page.getByText('座椅第 4 格')).toBeVisible()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
})

test('leaving keeps the workout, and discarding deletes it', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('深蹲')
  await page.getByRole('dialog').getByRole('button').filter({ hasText: '深蹲' }).first().click()
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1)

  // Back to the tab: the workout stays in progress and can be continued.
  await page.getByRole('link', { name: '训练', exact: true }).first().click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await page.getByRole('link', { name: /继续训练/ }).click()
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1)

  // Discarding asks twice, then returns to the tab with nothing in progress.
  await page.getByRole('button', { name: '结束训练' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '放弃这次训练' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /确认放弃/ })
    .click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByRole('button', { name: '开始训练' })).toBeVisible()
})

test('an exercise switched to pounds is typed and shown in pounds', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()

  await page.getByRole('button', { name: '这个动作改用 lb 显示和输入重量' }).click()
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.fill('45')
  await weight.press('Enter')
  await expect(weight).toHaveValue('45')
  await expect(page.getByText('≈ 20.41 kg')).toBeVisible()
  // One step in pounds is 5 lb.
  await page.getByRole('button', { name: '第 1 组加重量' }).click()
  await expect(weight).toHaveValue('50')
  await expect(page.getByText('≈ 22.68 kg')).toBeVisible()

  // The unit is kept for the exercise; switching back shows the same weight in kg.
  await page.reload()
  await expect(weight).toHaveValue('50')
  await page.getByRole('button', { name: '这个动作改用 kg 显示和输入重量' }).click()
  await expect(weight).toHaveValue('22.68')
  await expect(page.getByText(/≈/)).toHaveCount(0)
})
