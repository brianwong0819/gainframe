import { expect, test } from '@playwright/test'

// A plan is made of days in rotation, each with exercises; it is kept on the
// device like a workout (ROADMAP M1-09). The test runs in Chinese, the language
// the static export renders.
test.use({ locale: 'zh-CN' })

test('a new plan with two days and an exercise survives a reload', async ({ page }) => {
  await page.goto('/workout')
  await expect(page.getByRole('link', { name: /训练计划\s*还没有计划/ })).toBeVisible()
  await page.getByRole('link', { name: /训练计划/ }).click()
  await page.getByRole('button', { name: '新建计划' }).click()
  await expect(page).toHaveURL(/\/workout\/plan\/?#.+$/)

  // The first plan is the current one.
  await expect(page.getByText('这是当前计划')).toBeVisible()
  const name = page.getByRole('textbox', { name: '计划名称' })
  await name.fill('推拉腿')
  await name.press('Enter')
  const firstDay = page.getByRole('textbox', { name: '第 1 天的名称' })
  await firstDay.fill('推')
  await firstDay.press('Enter')
  await page.getByRole('button', { name: '加一天' }).click()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toHaveValue('第 2 天')

  await page.getByRole('button', { name: '添加动作' }).first().click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  // Shown once read back from the database (L-024).
  await expect(page.getByRole('main').getByText('3 组 · 8–12 次')).toBeVisible()
  await expect(name).toHaveValue('推拉腿')

  await page.reload()
  await expect(page.getByRole('textbox', { name: '计划名称' })).toHaveValue('推拉腿')
  await expect(page.getByRole('textbox', { name: '第 1 天的名称' })).toHaveValue('推')
  await expect(page.getByRole('main').getByText('杠铃卧推')).toBeVisible()

  await page.getByRole('link', { name: '训练计划' }).click()
  await expect(
    page.getByRole('link', { name: /推拉腿\s*当前\s*2 天循环 · 推 \/ 第 2 天/ }),
  ).toBeVisible()
})

test("an exercise's sets, rep range and suggested rest are kept", async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃深蹲')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃深蹲/ })
    .click()
  // The picker sheet sits inside the page; wait for it to close before tapping
  // the new row.
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /^杠铃深蹲 3 组/ }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '组数加一' }).click()
  // `fill` replaces the value: in WebKit the select-on-focus of a tapped field
  // can be undone by the tap itself, so typed digits would be appended.
  const repsMin = dialog.getByRole('textbox', { name: '最少次数' })
  await repsMin.fill('5')
  await repsMin.press('Enter')
  await expect(repsMin).toHaveValue('5')
  // The high end follows when the low end passes it.
  const repsMax = dialog.getByRole('textbox', { name: '最多次数' })
  await repsMax.fill('4')
  await repsMax.press('Enter')
  await expect(repsMax).toHaveValue('4')
  await dialog.getByRole('button', { name: '建议' }).click()
  await expect(dialog.getByRole('button', { name: '改回默认 3:00' })).toBeVisible()
  // WebKit leaves the page behind a modal dialog out of the accessibility tree,
  // so the row is checked once the sheet has closed.
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('main').getByText('4 组 · 4 次 · 休息 3:00')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('main').getByText('4 组 · 4 次 · 休息 3:00')).toBeVisible()
})
