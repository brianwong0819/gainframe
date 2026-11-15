import { expect, test } from '@playwright/test'

// Finished workouts are listed in history and open to their summary (ROADMAP
// M1-10). The test runs in Chinese, the language the export renders.
test.use({ locale: 'zh-CN' })

test('a finished workout is listed in history and opens to its summary', async ({ page }) => {
  await page.goto('/workout')
  await expect(page.getByRole('link', { name: /训练历史/ })).toContainText('还没有完成的训练')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const field = page.getByRole('textbox', { name: '第 1 组重量' })
  await field.fill('80')
  await field.press('Enter')
  await expect(field).toHaveValue('80')
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()
  await page.getByRole('button', { name: '结束训练' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
  await expect(page).toHaveURL(/\/workout\/summary\/?#/)

  await page.getByRole('link', { name: '完成', exact: true }).click()
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
