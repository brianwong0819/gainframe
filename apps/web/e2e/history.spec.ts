import { expect, type Locator, type Page, test } from '@playwright/test'

// Finished workouts are listed in history and open to their summary (ROADMAP
// M1-10). The test runs in Chinese, the language the export renders.
test.use({ locale: 'zh-CN' })

// Drags a row left with touch pointer events, as a finger would. Playwright's
// mouse in emulated WebKit ends a drag with a click, which a finger does not.
async function swipeLeft(row: Locator, distance: number) {
  await row.evaluate((element, dx) => {
    const box = element.getBoundingClientRect()
    const y = box.top + box.height / 2
    const startX = box.right - 20
    const event = (type: string, x: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
      })
    element.dispatchEvent(event('pointerdown', startX))
    for (let step = 1; step <= 10; step += 1) {
      window.dispatchEvent(event('pointermove', startX - (dx * step) / 10))
    }
    window.dispatchEvent(event('pointerup', startX - dx))
  }, distance)
}

// Finishes a workout of bench press with one 80 kg × 5 set per entry of
// `sets`, then returns to the Workout tab.
async function finishBench(page: Page, sets: number) {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  for (let n = 1; n <= sets; n += 1) {
    if (n > 1) {
      await page.getByRole('button', { name: '加一组' }).click()
      await page.getByRole('button', { name: `组 ${String(n)}`, exact: true }).click()
    }
    const weight = page.getByRole('textbox', { name: `第 ${String(n)} 组重量` })
    await weight.fill('80')
    await weight.press('Enter')
    await expect(weight).toHaveValue('80')
    const reps = page.getByRole('textbox', { name: `第 ${String(n)} 组次数` })
    await reps.fill('5')
    await reps.press('Enter')
    await expect(reps).toHaveValue('5')
    await page
      .getByRole('main')
      .getByRole('button', { name: `完成第 ${String(n)} 组` })
      .last()
      .click()
    await expect(page.getByRole('button', { name: `取消完成第 ${String(n)} 组` })).toBeVisible()
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
}

test('a finished workout is listed in history and opens to its summary', async ({ page }) => {
  await page.goto('/workout')
  await expect(page.getByRole('link', { name: /训练历史/ })).toContainText('还没有完成的训练')
  await finishBench(page, 1)

  await page.getByRole('link', { name: /训练历史/ }).click()
  await expect(page).toHaveURL(/\/workout\/history\/?$/)
  const card = page.getByRole('main').getByRole('listitem')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('自由训练')
  await expect(card).toContainText('杠铃卧推 · 1 组')
  await expect(card).toContainText('不到 1 分钟 · 1 组')

  await card.getByRole('link').click()
  await expect(page).toHaveURL(/\/workout\/past\/?#/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('自由训练')
  await expect(page.getByRole('definition').nth(2)).toHaveText('1')
  await expect(page.getByRole('listitem').filter({ hasText: '杠铃卧推' })).toContainText(
    '最重一组 80 kg',
  )

  await page.getByRole('link', { name: '训练历史' }).click()
  await expect(page).toHaveURL(/\/workout\/history\/?$/)
})

test('a past set can be edited, swiped away, and the workout deleted', async ({ page }) => {
  await finishBench(page, 2)
  await page.getByRole('link', { name: /训练历史/ }).click()
  await page.getByRole('main').getByRole('listitem').getByRole('link').click()
  const figures = page.getByRole('definition')
  await expect(figures.nth(1)).toHaveText('800 kg')

  // Edit: 6 reps on set 1. The sheet saves every change.
  await page.getByRole('button', { name: '编辑第 1 组：80 kg × 5' }).click()
  const sheet = page.getByRole('dialog', { name: '第 1 组 · 杠铃卧推' })
  const reps = sheet.getByRole('textbox', { name: '第 1 组次数' })
  await reps.fill('6')
  await reps.press('Enter')
  await expect(reps).toHaveValue('6')
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(sheet).toBeHidden()
  await expect(figures.nth(1)).toHaveText('880 kg')

  // Swipe set 2 left and delete it.
  const row = page.getByRole('button', { name: '编辑第 2 组：80 kg × 5' })
  await swipeLeft(row, 140)
  await page
    .getByRole('listitem')
    .filter({ has: row })
    .last()
    .getByText('删除', { exact: true })
    .click()
  await expect(row).toBeHidden()
  await expect(figures.nth(1)).toHaveText('480 kg')
  await expect(figures.nth(2)).toHaveText('1')

  // Delete the workout: the first tap asks, the second deletes.
  await page.getByRole('button', { name: '删除这次训练' }).click()
  await page.getByRole('button', { name: '确认删除（连同 1 组记录）' }).click()
  await expect(page).toHaveURL(/\/workout\/history\/?$/)
  await expect(page.getByText('还没有完成的训练。')).toBeVisible()
})
