import { expect, test } from '@playwright/test'

// ROADMAP M3-02: the daily targets are set on the Food tab, from the day card.
test.use({ locale: 'zh-CN' })

test('setting the daily targets turns the day card into protein to go', async ({ page }) => {
  await page.goto('/food')
  await expect(page.getByText('今天还没有记录饮食。')).toBeVisible()
  await page.getByRole('button', { name: '设定每日目标' }).click()

  const sheet = page.getByRole('dialog', { name: '每日目标' })
  await sheet.getByRole('button', { name: '提高蛋白质目标' }).click()
  await expect(sheet.getByRole('textbox', { name: '蛋白质目标（克）' })).toHaveValue('145')
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(sheet).toBeHidden()

  await expect(page.getByText('还差')).toBeVisible()
  await expect(page.getByRole('button', { name: '修改每日目标' })).toContainText('0 / 145 g')
  await expect(page.getByText('热量 0 / 2,800 kcal')).toBeVisible()

  // The target is stored: it survives a reload.
  await page.reload()
  await expect(page.getByRole('button', { name: '修改每日目标' })).toContainText('0 / 145 g')
})

test('a meal typed from a label is logged, and its food is then one tap away', async ({ page }) => {
  await page.goto('/food')
  await page.getByRole('link', { name: '手动添加' }).click()
  await expect(page).toHaveURL(/\/food\/add\/?$/)
  await expect(page.getByRole('button', { name: '先选食物' })).toBeDisabled()

  await page.getByRole('button', { name: '新建食物' }).click()
  const sheet = page.getByRole('dialog', { name: '新建食物' })
  await sheet.getByLabel('名称').fill('希腊酸奶')
  await sheet.getByLabel('每份克数').fill('150')
  await sheet.getByLabel('蛋白质 g').fill('15')
  await sheet.getByLabel('热量 kcal').fill('100')
  await sheet.getByRole('button', { name: '加入这餐' }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('button', { name: '加一份希腊酸奶' }).click()
  await page.getByRole('button', { name: /^记入.* · 1 项 · 30 g$/ }).click()
  await expect(page).toHaveURL(/\/food\/?$/)
  await expect(page.getByText('希腊酸奶')).toBeVisible()
  await expect(page.getByText('蛋白质 30 g')).toBeVisible()

  // Two portions were logged, so the food comes back as last time's 300 g.
  await page.getByRole('link', { name: '手动添加' }).click()
  await expect(page.getByText('300 g · 蛋白质 30 g · 200 kcal').first()).toBeVisible()
  await page.getByRole('button', { name: '加一份希腊酸奶' }).first().click()
  await expect(page.getByRole('button', { name: /^记入.* · 1 项 · 30 g$/ })).toBeEnabled()
})
