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
