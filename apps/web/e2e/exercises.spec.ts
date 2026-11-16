import { expect, test } from '@playwright/test'

// The library shows the user's best set of an exercise and can be narrowed to
// the exercises they have done. The test runs in Chinese, the language the
// static export renders.
test.use({ locale: 'zh-CN' })

test('a done exercise shows its best set and passes the "done" filter', async ({ page }) => {
  await page.goto('/workout/exercises')
  const list = page.getByRole('list', { name: '动作' })
  await expect(list.getByRole('listitem').first()).toBeVisible()
  // Nothing has been done yet, so the filter is not offered.
  await expect(page.getByRole('button', { name: '练过' })).toHaveCount(0)

  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.fill('80')
  await weight.press('Enter')
  await expect(weight).toHaveValue('80')
  const reps = page.getByRole('textbox', { name: '第 1 组次数' })
  await reps.fill('5')
  await reps.press('Enter')
  await expect(reps).toHaveValue('5')
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()

  await page.goto('/workout/exercises')
  await expect(list.getByRole('listitem').filter({ hasText: '杠铃卧推' }).first()).toContainText(
    '最好 80 kg × 5',
  )
  await page.getByRole('button', { name: '练过' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  // With a muscle group nothing was done for, the list says so.
  await page.getByRole('button', { name: '背', exact: true }).click()
  await expect(page.getByText('这个筛选下还没有练过的动作。')).toBeVisible()
})
