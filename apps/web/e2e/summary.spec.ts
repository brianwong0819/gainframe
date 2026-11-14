import { expect, type Page, test } from '@playwright/test'

// Finishing a workout opens its summary: duration, volume, sets and records
// (ROADMAP M1-08). The test runs in Chinese, the language the export renders.
test.use({ locale: 'zh-CN' })

// One workout of bench press with a single set of `weight` × 5, finished.
async function benchWorkout(page: Page, weight: string) {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const field = page.getByRole('textbox', { name: '第 1 组重量' })
  await field.fill(weight)
  await field.press('Enter')
  await expect(field).toHaveValue(weight)
  const reps = page.getByRole('textbox', { name: '第 1 组次数' })
  await reps.fill('5')
  await reps.press('Enter')
  await expect(reps).toHaveValue('5')
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  await page.getByRole('button', { name: '结束训练' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#/)
}

test('the summary totals the workout and lists a new record', async ({ page }) => {
  await benchWorkout(page, '80')
  await expect(page.getByRole('heading', { name: '训练完成' })).toBeVisible()
  // The first workout of an exercise sets no record.
  await expect(page.getByRole('definition').nth(3)).toHaveText('0')

  await benchWorkout(page, '85')
  const figures = page.getByRole('definition')
  await expect(figures.nth(1)).toHaveText('425 kg')
  await expect(figures.nth(2)).toHaveText('1')
  await expect(figures.nth(3)).toHaveText('1')
  const exercise = page.getByRole('listitem').filter({ hasText: '杠铃卧推' })
  await expect(exercise).toContainText('新纪录')
  await expect(exercise).toContainText('85 kg × 5')
  await expect(exercise).toContainText('估算 1RM 99.2 kg')

  await page.getByRole('link', { name: '完成', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByRole('button', { name: '开始训练' })).toBeVisible()
})

test.describe('with motion', () => {
  // The suite runs with Reduce Motion, which turns celebrations off.
  test.use({ reducedMotion: 'no-preference' })

  test('a record set gets the plates and the "New PR" tag; a normal set only chalk', async ({
    page,
  }) => {
    await benchWorkout(page, '80')
    await page.getByRole('link', { name: '完成', exact: true }).click()
    await page.getByRole('button', { name: '开始训练' }).click()
    await page.getByRole('button', { name: '添加动作' }).click()
    await page.getByRole('searchbox').fill('杠铃卧推')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^杠铃卧推/ })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('button', { name: '加一组' }).click()
    await expect(page.getByRole('button', { name: '组 2', exact: true })).toBeVisible()

    // Last time's 80 × 5 again: chalk, no tag, and the rest sheet.
    await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
    await page
      .getByRole('dialog', { name: '组间休息' })
      .getByRole('button', { name: '开始下一组' })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('.celebration-layer')).toHaveCount(1)
    await expect(page.locator('.record-badge')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '组 1', exact: true })).not.toContainText(
      '新纪录',
    )

    // 85 × 5 beats it: the tag rises, and the row keeps "新纪录".
    const weight = page.getByRole('textbox', { name: '第 2 组重量' })
    await weight.fill('85')
    await weight.press('Enter')
    await expect(weight).toHaveValue('85')
    await page.getByRole('main').getByRole('button', { name: '完成第 2 组' }).last().click()
    await expect(page.locator('.record-badge')).toHaveText('新纪录')
    await expect(page.getByRole('button', { name: '组 2', exact: true })).toContainText('新纪录')
  })
})
