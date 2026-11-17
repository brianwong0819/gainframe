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
  const dialog = page.getByRole('dialog')
  await page.getByRole('searchbox').fill('杠铃卧推')
  await dialog.getByRole('button', { name: /^杠铃卧推/ }).click()
  // A tap shows the exercise's detail first; back keeps the search.
  await expect(dialog.getByRole('heading', { name: '杠铃卧推' })).toBeVisible()
  await expect(dialog.getByRole('img', { name: /^肌肉示意图。主要：胸/ })).toBeVisible()
  await dialog.getByRole('button', { name: '返回动作列表' }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('杠铃卧推')
  await dialog.getByRole('button', { name: /^杠铃卧推/ }).click()
  await dialog.getByRole('button', { name: '加入「推」' }).click()
  await expect(dialog).toBeHidden()
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

test("an exercise's sets, rep range and rest are kept, and its detail opens", async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃深蹲')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃深蹲/ })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '加入「第 1 天」' }).click()
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
  await dialog.getByRole('button', { name: '休息加 15 秒' }).click()
  await expect(dialog.getByRole('button', { name: '改回默认 3:00' })).toBeVisible()
  // The same detail as the library, and back to the settings.
  await dialog.getByRole('button', { name: '动作详情' }).click()
  await expect(dialog.getByRole('img', { name: /^肌肉示意图。主要：股四头/ })).toBeVisible()
  await dialog.getByRole('button', { name: '返回设置' }).click()
  await expect(dialog.getByRole('textbox', { name: '最多次数' })).toHaveValue('4')
  // WebKit leaves the page behind a modal dialog out of the accessibility tree,
  // so the row is checked once the sheet has closed.
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('main').getByText('4 组 · 4 次 · 休息 3:15')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('main').getByText('4 组 · 4 次 · 休息 3:15')).toBeVisible()
})

test("the Workout tab offers the current plan's next day and starts it", async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  const firstDay = page.getByRole('textbox', { name: '第 1 天的名称' })
  await firstDay.fill('推')
  await firstDay.press('Enter')
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '加入「推」' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  // The plan note is saved when its field loses focus, and shown on the row.
  await page.getByRole('button', { name: /^杠铃卧推 3 组/ }).click()
  const note = page.getByRole('dialog').getByRole('textbox', { name: '计划备注' })
  await note.fill('握距比肩宽一指')
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('main').getByText('握距比肩宽一指')).toBeVisible()
  // The day adds itself up, and the row shows the rest the exercise will get.
  await expect(page.getByText('1 个动作 · 约 10 分钟')).toBeVisible()
  await expect(page.getByRole('button', { name: /^杠铃卧推 3 组/ })).toContainText('休息 3:00')
  await page.getByRole('button', { name: '加一天' }).click()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toHaveValue('第 2 天')

  await page.getByRole('link', { name: '训练计划' }).click()
  await page.getByRole('link', { name: '训练', exact: true }).first().click()
  await expect(page.getByText('第 1/2 天 · 新计划')).toBeVisible()
  // Three sets of 45 s with the bench press's 3:00 rest, to the nearest five minutes.
  await expect(page.getByText('约 10 分钟')).toBeVisible()
  await page.getByRole('button', { name: '开始「推」' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await expect(page.getByText('目标 8–12 次')).toBeVisible()
  await expect(page.getByText('计划 · 握距比肩宽一指')).toBeVisible()
  // The ⓘ beside the name opens the exercise's detail.
  await page.getByRole('button', { name: '杠铃卧推 的动作详情' }).click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByRole('img', { name: /^肌肉示意图。主要：胸/ })).toBeVisible()
  await detail.getByRole('button', { name: '关闭' }).click()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: '完成第 3 组' })).toBeVisible()

  const firstWeight = page.getByRole('textbox', { name: '第 1 组重量' })
  await firstWeight.fill('60')
  await firstWeight.press('Enter')
  await expect(firstWeight).toHaveValue('60')
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  // Two sets are still to do, so the rest sheet opens; "start next set" ends the rest.
  await page
    .getByRole('dialog', { name: '组间休息' })
    .getByRole('button', { name: '开始下一组' })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  // The exercise was never done, so the next set takes the weight just entered.
  await expect(page.getByRole('textbox', { name: '第 2 组重量' })).toHaveValue('60')
  await page.getByRole('button', { name: '结束训练' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#/)
  await page.getByRole('link', { name: '完成', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/?$/)
  await expect(page.getByText('第 2/2 天 · 新计划')).toBeVisible()
})

test('a day is deleted from its menu, after a second tap', async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByRole('button', { name: '加一天' }).click()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toBeVisible()

  await page.getByRole('button', { name: '「第 2 天」的更多操作' }).click()
  const menu = page.getByRole('dialog', { name: '第 2 天' })
  await menu.getByRole('button', { name: '删除这一天' }).click()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toBeVisible()
  await menu.getByRole('button', { name: '确认删除「第 2 天」' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '第 1 天的名称' })).toBeVisible()
})

test('an exercise is added to a plan day from its detail, and a workout saved as a day', async ({
  page,
}) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await expect(page.getByRole('textbox', { name: '第 1 天的名称' })).toHaveValue('第 1 天')

  await page.goto('/workout/exercises')
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('main')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '加入计划' }).click()
  await dialog.getByRole('button', { name: /^第 1 天\s*新计划/ }).click()
  await expect(dialog.getByRole('button', { name: /已加入/ })).toBeDisabled()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()

  // An empty workout with one done set, finished and saved as the plan's day 2.
  await page.goto('/workout')
  await page.getByRole('button', { name: '空白训练' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃深蹲')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃深蹲/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  await page.getByRole('button', { name: '结束训练' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '结束，并存成计划的新一天' }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#/)
  await page.getByRole('link', { name: '训练', exact: true }).first().click()
  await expect(page).toHaveURL(/\/workout\/?$/)

  await page.getByRole('link', { name: /训练计划/ }).click()
  await page.getByRole('link', { name: /新计划/ }).click()
  await expect(page.getByRole('textbox', { name: '第 2 天的名称' })).toHaveValue('第 2 天')
  await expect(page.getByRole('button', { name: /^杠铃卧推 3 组/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^杠铃深蹲 1 组 · 8 次/ })).toBeVisible()
})

// The prerendered page shows its content before React has attached its event
// handlers; a tap in that window was lost and the editor never opened.
test('"新建计划" opens the editor even when tapped as soon as it shows', async ({ page }) => {
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue()
  })
  await page.goto('/workout/plans', { waitUntil: 'commit' })
  await page.getByRole('button', { name: '新建计划' }).click()
  await expect(page.getByRole('textbox', { name: '第 1 天的名称' })).toHaveValue('第 1 天')
})

test('a superset linked in the plan carries into its workout', async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  for (const name of ['杠铃卧推', '杠铃深蹲']) {
    await page.getByRole('button', { name: '添加动作' }).click()
    await page.getByRole('searchbox').fill(name)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .click()
    await page.getByRole('dialog').getByRole('button', { name: '加入「第 1 天」' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('button', { name: new RegExp(`^${name} 3 组`) })).toBeVisible()
  }
  // Squat moves above bench press, then joins it as a superset.
  await page.getByRole('button', { name: /^杠铃深蹲 3 组/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '上移' }).click()
  // Each write shows in the sheet once read back from the database (L-024).
  await expect(dialog.getByRole('button', { name: '上移' })).toBeDisabled()
  await dialog.getByRole('button', { name: '和「杠铃卧推」组成超级组' }).click()
  // Joining opens the superset's own rounds and rest, starting from the longer
  // rest of the two (the bench press's 3:00).
  await expect(dialog.getByRole('heading', { name: '超级组 A' })).toBeVisible()
  await expect(
    dialog.getByText('一轮 = 杠铃深蹲 → 杠铃卧推 各做一组', { exact: false }),
  ).toBeVisible()
  await expect(dialog.locator('output')).toHaveText('3:00')
  await dialog.getByRole('button', { name: '轮数加一' }).click()
  await dialog.getByRole('button', { name: '休息减 15 秒' }).click()
  await expect(dialog.locator('output')).toHaveText('2:45')
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  const block = page.getByRole('region', { name: '超级组 A · 轮流做' })
  await expect(block.getByRole('button', { name: /4 轮 · 休息 2:45/ })).toBeVisible()
  // A member keeps only its own rep range; its sets and rest are the superset's.
  await block.getByRole('button', { name: /^A1 杠铃深蹲/ }).click()
  await expect(dialog.getByRole('button', { name: '组数加一' })).toBeHidden()
  await dialog.getByRole('button', { name: /轮数和休息由超级组 A 设定/ }).click()
  await expect(dialog.getByRole('heading', { name: '超级组 A' })).toBeVisible()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /^A2 杠铃卧推/ })).not.toContainText('休息')

  await page.getByRole('link', { name: '训练计划' }).click()
  await page.getByRole('link', { name: '训练', exact: true }).first().click()
  await page.getByRole('button', { name: '开始「第 1 天」' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)
  await expect(page.locator('.set-panel')).toContainText('A1 · 杠铃深蹲 · 组 1')
  await expect(page.getByRole('region', { name: '超级组 A · 轮流做' })).toBeVisible()
})

test('an exercise missing from the library is created from the picker and added to the day', async ({
  page,
}) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  const dialog = page.getByRole('dialog')
  await page.getByRole('searchbox').fill('地雷管推举')
  await dialog.getByRole('button', { name: '新建“地雷管推举”' }).click()

  // The form is named after the search; back keeps the search.
  await expect(dialog.getByRole('textbox', { name: '中文名称' })).toHaveValue('地雷管推举')
  await dialog.getByRole('button', { name: '返回动作列表' }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('地雷管推举')
  await dialog.getByRole('button', { name: '新建“地雷管推举”' }).click()
  await dialog.getByRole('button', { name: '肩', exact: true }).click()
  await dialog.getByRole('button', { name: '保存' }).click()

  await expect(dialog).toBeHidden()
  // Shown once read back from the database (L-024).
  await expect(page.getByRole('main').getByText('地雷管推举')).toBeVisible()
  await page.goto('/workout/exercises')
  await expect(page.getByRole('main').getByRole('button', { name: /^地雷管推举/ })).toBeVisible()
})
