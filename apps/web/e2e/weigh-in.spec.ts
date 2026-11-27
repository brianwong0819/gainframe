import { expect, test } from '@playwright/test'

// ROADMAP M4-02: the day's weight is logged from Today in two taps, through
// the weigh-in sheet, and a second weigh-in the same day replaces the first.
test.use({ locale: 'zh-CN' })

test('Today logs the day weight in two taps and corrects it', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '体重' }) })
  await expect(card).toContainText('今天还没称')

  await card.getByRole('button', { name: '记体重' }).click()
  const sheet = page.getByRole('dialog', { name: '记体重' })
  // A weight-only weigh-in shows no composition fields until asked for.
  await expect(sheet.getByText('体脂率 · %')).toHaveCount(0)
  await sheet.getByRole('button', { name: '加 0.1 公斤' }).click()
  await sheet.getByRole('button', { name: '记下 65.1 kg' }).click()
  await expect(sheet).toBeHidden()
  await expect(card).toContainText('今天 65.1 kg')
  await expect(card).toContainText('再称 6 天就能看到 7 日平均。')

  await card.getByRole('button', { name: '修改' }).click()
  await expect(sheet).toContainText('今天已记 65.1 kg')
  await sheet.getByRole('button', { name: '减 0.1 公斤' }).click()
  await sheet.getByRole('button', { name: '减 0.1 公斤' }).click()
  await sheet.getByRole('button', { name: '记下 64.9 kg' }).click()
  await expect(card).toContainText('今天 64.9 kg')
  await expect(card).toContainText('再称 6 天')
})
