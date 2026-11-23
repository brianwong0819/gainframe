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
  await page.getByRole('button', { name: '杠铃卧推 的选项' }).click()
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

test('a ticked set is corrected from its row, and later sets follow', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.locator('.set-panel')).toContainText('杠铃卧推 · 组 1/1')
  // Steps, not typing: where a tap leaves the caret in the field differs by engine.
  const heavier = page.getByRole('button', { name: '第 1 组加重量' })
  await heavier.click()
  await heavier.click()
  await expect(page.getByRole('textbox', { name: '第 1 组重量' })).toHaveValue('5')
  await page.getByRole('button', { name: '加一组' }).click()
  await page.getByRole('button', { name: '完成第 1 组' }).first().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  const rest = page.getByRole('dialog', { name: '组间休息' })
  await expect(rest).toBeVisible()
  await rest.getByRole('button', { name: '关闭' }).click()
  await expect(rest).toBeHidden()

  // The done row opens its weight and reps; one step up moves set 2 with it.
  await page.getByRole('button', { name: '组 1', exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: '杠铃卧推 · 组 1' })).toBeVisible()
  await sheet.getByRole('button', { name: '第 1 组加重量' }).click()
  await expect(sheet.getByRole('textbox', { name: '第 1 组重量' })).toHaveValue('7.5')
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('button', { name: '组 1', exact: true })).toContainText('7.5')
  await expect(page.getByRole('button', { name: '组 2', exact: true })).toContainText('7.5')
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
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  // The only set is done, so no rest follows.
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: '结束训练' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '放弃这次训练' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '确认放弃（删除已完成的 1 组）' })
    .click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByRole('button', { name: '开始训练' })).toBeVisible()
})

test('finishing a workout with no ticked set does not keep it', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('深蹲')
  await page.getByRole('dialog').getByRole('button').filter({ hasText: '深蹲' }).first().click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: '结束训练' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('一组都没有打勾，结束后这次训练不会保存。')
  await expect(dialog.getByRole('button', { name: '放弃这次训练' })).toHaveCount(0)
  await dialog.getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByRole('link', { name: /训练历史/ })).toContainText('还没有完成的训练')
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
  // The unit is read back from the database; typing before it arrives would
  // parse the weight in kg (L-024).
  await expect(page.getByRole('button', { name: '这个动作改用 kg 显示和输入重量' })).toBeVisible()
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.fill('45')
  await weight.press('Enter')
  await expect(weight).toHaveValue('45')
  await expect(page.getByText('≈ 20.4 kg')).toBeVisible()
  // One step in pounds is 5 lb.
  await page.getByRole('button', { name: '第 1 组加重量' }).click()
  await expect(weight).toHaveValue('50')
  await expect(page.getByText('≈ 22.7 kg')).toBeVisible()

  // The unit is kept for the exercise; switching back shows the same weight in kg,
  // to 0.1 kg because it is off the 0.25 kg grid.
  await page.reload()
  await expect(weight).toHaveValue('50')
  await page.getByRole('button', { name: '这个动作改用 kg 显示和输入重量' }).click()
  await expect(weight).toHaveValue('22.7')
  await expect(page.getByText(/≈/)).toHaveCount(0)
  // A step from a weight converted from pounds lands on the 2.5 kg grid.
  await page.getByRole('button', { name: '第 1 组加重量' }).click()
  await expect(weight).toHaveValue('25')
})

test('the header counts the sets, and the finish prompt replaces the panel', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()

  const header = page.getByRole('main').locator('header')
  await expect(header.getByRole('timer')).toHaveText(/^\d+:\d{2}$/)
  await expect(header).toContainText('0/1 组')
  // The button names the set for a screen reader and shows what it will log.
  const panel = page.locator('.set-panel')
  await expect(panel).toContainText('杠铃卧推 · 组 1/1')
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.fill('60')
  await weight.press('Enter')
  await expect(panel.getByRole('button', { name: '完成第 1 组' })).toContainText('60 kg × ')

  await panel.getByRole('button', { name: '完成第 1 组' }).click()
  await expect(header).toContainText('1/1 组')
  await expect(panel).toBeHidden()
  const prompt = page.locator('.dock-panel')
  await expect(prompt).toContainText('1 组全部完成')
  await prompt.getByRole('button', { name: '结束训练' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#.+$/)
})

test('the Workout tab shows the workout in progress, then the week it counts for', async ({
  page,
}) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: '加一组' }).click()
  await page.getByRole('button', { name: '组 1', exact: true }).click()
  const panel = page.locator('.set-panel')
  await panel.getByRole('button', { name: '完成第 1 组' }).click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  const rest = page.getByRole('dialog', { name: '组间休息' })
  await rest.getByRole('button', { name: '开始下一组' }).click()
  await expect(rest).toBeHidden()

  await page.getByRole('link', { name: '训练', exact: true }).first().click()
  const card = page.getByRole('link', { name: /继续训练/ })
  await expect(card).toContainText('下一组：杠铃卧推 · 组 2')
  await expect(card).toContainText('1/2 组')
  await expect(card.getByRole('timer')).toHaveText(/^\d+:\d{2}$/)
  // Nothing is finished yet, so there is no week to show.
  await expect(page.getByRole('heading', { name: '本周' })).toBeHidden()

  await card.click()
  await panel.getByRole('button', { name: '完成第 2 组' }).click()
  await expect(page.getByRole('button', { name: '取消完成第 2 组' })).toBeVisible()
  await page.getByRole('button', { name: '结束训练' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#.+$/)
  await page.getByRole('link', { name: '训练', exact: true }).first().click()

  const week = page.locator('section').filter({ has: page.getByRole('heading', { name: '本周' }) })
  await expect(week).toContainText('1 次 · 2 组')
  await expect(week.getByRole('listitem', { name: /，已训练$/ })).toHaveCount(1)
})
