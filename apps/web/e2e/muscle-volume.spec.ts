import { expect, test } from '@playwright/test'

// The volume page's muscle section: a completed set colours its muscles, the
// rows show half sets for secondary muscles, and the selected group's button
// opens the library filtered to it, with the way back to the volume page.
test.use({ locale: 'zh-CN' })

test('a completed set counts for its muscles on the volume page', async ({ page }) => {
  await page.goto('/progress')
  const card = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '训练量 · 近 7 天' }) })
  await expect(card.getByRole('link', { name: '去训练' })).toBeVisible()

  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()

  await page.goto('/progress')
  await page.getByRole('link', { name: /训练量/ }).click()
  await expect(page).toHaveURL(/\/progress\/volume$/)
  const rows = page.getByRole('list', { name: '各肌群组数' })
  await expect(rows.getByRole('button', { name: '胸，1 组，偏少' })).toBeVisible()
  await expect(rows.getByRole('button', { name: '三头，0.5 组，没专门练' })).toBeVisible()

  await rows.getByRole('button', { name: /^胸/ }).click()
  await page.getByRole('link', { name: '找胸动作' }).click()
  await expect(page).toHaveURL(/\/workout\/exercises#chest$/)
  await expect(page.getByRole('button', { name: '胸', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.locator('[data-back-link]').click()
  await expect(page).toHaveURL(/\/progress\/volume$/)
})

// ROADMAP M4-07: the weekly bars above the muscle section. Selecting a week
// switches the muscle section to it, with the way back to the last 7 days.
test('a week bar selects that week for the muscle section', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()

  await page.goto('/progress/volume')
  await expect(page.getByRole('heading', { name: '本周 · 到今天' })).toBeVisible()
  await expect(page.getByText('这周还没结束')).toBeVisible()
  await expect(page.getByText('近 7 天 ·')).toBeVisible()

  const bars = page.getByRole('button', { name: /那周，/ })
  await expect(bars).toHaveCount(12)
  await bars.last().click()
  await expect(bars.last()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/^.+–.+ 那周$/)).toBeVisible()
  await bars.nth(10).click()
  await expect(page.getByRole('heading', { name: /那周$/ })).toBeVisible()
  const rows = page.getByRole('list', { name: '各肌群组数' })
  await expect(rows.getByRole('button', { name: '胸，0 组，未练' })).toBeVisible()

  await page.getByRole('button', { name: '回到近 7 天' }).click()
  await expect(page.getByText('近 7 天 ·')).toBeVisible()
  await expect(rows.getByRole('button', { name: '胸，1 组，偏少' })).toBeVisible()

  await page.getByRole('button', { name: 'kg', exact: true }).click()
  await expect(page.getByRole('heading', { name: '本周 · 到今天' })).toBeVisible()
})
