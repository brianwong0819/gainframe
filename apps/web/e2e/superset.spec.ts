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
  const cards = page.getByRole('main').locator('section')
  for (const card of [cards.first(), cards.last()]) {
    await card.getByRole('button', { name: '加一组' }).click()
    await card.getByRole('button', { name: '加一组' }).click()
    await expect(card.getByRole('button', { name: '完成第 3 组' })).toBeVisible()
  }

  const link = page.getByRole('button', { name: '杠铃卧推 和 杠铃深蹲 组成超级组' })
  await link.click()
  await expect(link).toHaveAttribute('aria-pressed', 'true')
  await expect(cards.first().getByText('A1', { exact: true })).toBeVisible()
  await expect(cards.last().getByText('A2', { exact: true })).toBeVisible()

  // Adding a set selected it; selecting the first set hands the order back to
  // the panel, which then completes the next set in superset order each time.
  await cards.first().getByRole('button', { name: '组 1', exact: true }).click()
  const panel = page.locator('.set-panel')
  const rest = page.getByRole('dialog', { name: '组间休息' })
  const pill = page.getByRole('button', { name: '展开休息计时' })
  for (let round = 1; round <= 3; round += 1) {
    await expect(panel).toContainText(`A1 · 杠铃卧推 · 组 ${String(round)}`)
    await panel.getByRole('button', { name: `完成第 ${String(round)} 组` }).click()
    await expect(
      cards.first().getByRole('button', { name: `取消完成第 ${String(round)} 组` }),
    ).toBeVisible()
    await expect(rest).toBeHidden()
    await expect(pill).toBeHidden()

    await expect(panel).toContainText(`A2 · 杠铃深蹲 · 组 ${String(round)}`)
    await panel.getByRole('button', { name: `完成第 ${String(round)} 组` }).click()
    await expect(
      cards.last().getByRole('button', { name: `取消完成第 ${String(round)} 组` }),
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

  // Splitting the pair makes both exercises standalone again.
  await link.click()
  await expect(link).toHaveAttribute('aria-pressed', 'false')
  await expect(cards.first().getByText('A1', { exact: true })).toBeHidden()
})
