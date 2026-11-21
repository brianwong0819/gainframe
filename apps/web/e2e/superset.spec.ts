import { expect, type Page, test } from '@playwright/test'

// A superset alternates its exercises and rests only after a full round
// (ROADMAP M1-07 Verify: three rounds of A1/A2 start the timer only at the end
// of each round). The test runs in Chinese, the language the static export renders.
test.use({ locale: 'zh-CN' })

async function addExercise(page: Page, search: string, name: RegExp) {
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill(search)
  await page.getByRole('dialog').getByRole('button', { name }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('three rounds of A1/A2 rest only at the end of each round', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await addExercise(page, '杠铃卧推', /^杠铃卧推/)
  await addExercise(page, '杠铃深蹲', /^杠铃深蹲/)
  const card = (name: string) =>
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name }) })
      .last()
  const bench = card('杠铃卧推')
  const squat = card('杠铃深蹲')
  await bench.getByRole('button', { name: '加一组' }).click()
  await bench.getByRole('button', { name: '加一组' }).click()
  await expect(bench.getByRole('button', { name: '完成第 3 组' })).toBeVisible()

  // Joined from the bench press's options, the two show as one block with as
  // many sets each, and the sheet turns to the superset's one rest, starting
  // from the longer of the two (the bench press's 3:00).
  await page.getByRole('button', { name: '杠铃卧推 的选项' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '和「杠铃深蹲」组成超级组' }).click()
  await expect(dialog.getByRole('heading', { name: '超级组 A' })).toBeVisible()
  await expect(dialog.locator('output')).toHaveText('3:00')
  await dialog.getByRole('button', { name: '少休息 15 秒' }).click()
  await expect(dialog.locator('output')).toHaveText('2:45')
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  const block = page.getByRole('region', { name: '超级组 A · 轮流做' })
  await expect(block.getByRole('button', { name: /第 1\/3 轮 · 休息 2:45/ })).toBeVisible()
  await expect(squat.getByRole('button', { name: '完成第 3 组' })).toBeVisible()
  await expect(bench.getByText('A1', { exact: true })).toBeVisible()
  await expect(squat.getByText('A2', { exact: true })).toBeVisible()

  // Adding a set selected it; selecting the first set hands the order back to
  // the panel, which then completes the next set in superset order each time.
  await bench.getByRole('button', { name: '组 1', exact: true }).click()
  const panel = page.locator('.set-panel')
  const rest = page.getByRole('dialog', { name: '组间休息' })
  const pill = page.getByRole('button', { name: '展开休息计时' })
  for (let round = 1; round <= 3; round += 1) {
    await expect(panel).toContainText(`A1 · 杠铃卧推 · 组 ${String(round)}`)
    await panel.getByRole('button', { name: `完成第 ${String(round)} 组` }).click()
    await expect(
      bench.getByRole('button', { name: `取消完成第 ${String(round)} 组` }),
    ).toBeVisible()
    await expect(rest).toBeHidden()
    await expect(pill).toBeHidden()

    await expect(panel).toContainText(`A2 · 杠铃深蹲 · 组 ${String(round)}`)
    await panel.getByRole('button', { name: `完成第 ${String(round)} 组` }).click()
    await expect(
      squat.getByRole('button', { name: `取消完成第 ${String(round)} 组` }),
    ).toBeVisible()
    if (round < 3) {
      await expect(rest).toBeVisible()
      await rest.getByRole('button', { name: '关闭' }).click()
      await expect(pill).toBeVisible()
    } else {
      // Nothing is left to do after the last round, so no rest follows it.
      await expect(rest).toBeHidden()
      await expect(panel).toBeHidden()
    }
  }

  await expect(block).toContainText('第 3/3 轮')

  // A superset grows by a round: one more set for each exercise.
  await squat.getByRole('button', { name: '加一轮' }).click()
  await expect(block).toContainText('第 4/4 轮')
  await expect(bench.getByRole('button', { name: '完成第 4 组' })).toBeVisible()

  // Splitting the pair makes both exercises standalone again.
  await page.getByRole('button', { name: '杠铃卧推 的选项' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '和「杠铃深蹲」拆开' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click()
  await expect(block).toBeHidden()
  await expect(bench.getByText('A1', { exact: true })).toBeHidden()
})

// A check two rounds ahead is most likely a mis-tap and would end the running
// rest, so it asks first; cancelling leaves the rest running.
test('a set of a later round asks before it is completed', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await addExercise(page, '杠铃卧推', /^杠铃卧推/)
  await addExercise(page, '杠铃深蹲', /^杠铃深蹲/)
  const card = (name: string) =>
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name }) })
      .last()
  const bench = card('杠铃卧推')
  const squat = card('杠铃深蹲')
  await bench.getByRole('button', { name: '加一组' }).click()
  await bench.getByRole('button', { name: '加一组' }).click()
  await expect(bench.getByRole('button', { name: '完成第 3 组' })).toBeVisible()
  await page.getByRole('button', { name: '杠铃卧推 的选项' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '和「杠铃深蹲」组成超级组' }).click()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()

  // Round 1 from the table's checks, in order: no question, and the rest starts.
  await bench.getByRole('button', { name: '完成第 1 组' }).click()
  await expect(bench.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  await squat.getByRole('button', { name: '完成第 1 组' }).click()
  const rest = page.getByRole('dialog', { name: '组间休息' })
  await expect(rest).toBeVisible()
  await rest.getByRole('button', { name: '关闭' }).click()
  const pill = page.getByRole('button', { name: '展开休息计时' })
  await expect(pill).toBeVisible()

  // Round 3 while round 2 is in progress asks; cancelling changes nothing.
  await squat.getByRole('button', { name: '完成第 3 组' }).click()
  const ahead = page.getByRole('dialog', { name: '还没轮到这一组' })
  await expect(ahead).toContainText('第 2 轮还没做完，这一组属于第 3 轮。')
  await ahead.getByRole('button', { name: '取消' }).click()
  await expect(ahead).toBeHidden()
  await expect(squat.getByRole('button', { name: '完成第 3 组' })).toBeVisible()
  await expect(pill).toBeVisible()

  // Confirming completes it.
  await squat.getByRole('button', { name: '完成第 3 组' }).click()
  await ahead.getByRole('button', { name: '仍然完成' }).click()
  await expect(squat.getByRole('button', { name: '取消完成第 3 组' })).toBeVisible()
})

test('a standalone exercise asks before a set is skipped', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await addExercise(page, '杠铃卧推', /^杠铃卧推/)
  await page.getByRole('button', { name: '加一组' }).click()
  await page.getByRole('button', { name: '加一组' }).click()
  await page.getByRole('button', { name: '组 1', exact: true }).click()

  await page.getByRole('button', { name: '完成第 3 组' }).click()
  const ahead = page.getByRole('dialog', { name: '还没轮到这一组' })
  await expect(ahead).toContainText('第 1 组还没完成。')
  await ahead.getByRole('button', { name: '取消' }).click()
  await expect(ahead).toBeHidden()
  await expect(page.getByRole('button', { name: '完成第 3 组' })).toBeVisible()

  // The set the panel shows was chosen on purpose, so its check never asks.
  await page.getByRole('button', { name: '组 3', exact: true }).click()
  await page.locator('ol').getByRole('button', { name: '完成第 3 组' }).click()
  await expect(page.getByRole('button', { name: '取消完成第 3 组' })).toBeVisible()
  await expect(ahead).toBeHidden()
})

test('moving an exercise up changes the order the panel follows', async ({ page }) => {
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await addExercise(page, '杠铃卧推', /^杠铃卧推/)
  await addExercise(page, '杠铃深蹲', /^杠铃深蹲/)
  await expect(page.locator('.set-panel')).toContainText('杠铃卧推 · 组 1')

  await page.getByRole('button', { name: '杠铃深蹲 的选项' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '下移' })).toBeDisabled()
  await dialog.getByRole('button', { name: '上移' }).click()
  await expect(dialog.getByRole('button', { name: '上移' })).toBeDisabled()
  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('杠铃深蹲')
  await expect(page.locator('.set-panel')).toContainText('杠铃深蹲 · 组 1')
})
