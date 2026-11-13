import { expect, test } from '@playwright/test'

// The rest after a set counts down from its stored end, so it survives a
// reload, and once over it shows how long ago it ended (ROADMAP M1-06, ADR-0005).
// The test runs in Chinese, the language the static export renders.
test.use({ locale: 'zh-CN' })

test('completing a set starts its rest, which survives a reload and ends on a tap', async ({
  page,
}) => {
  await page.clock.install()
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
  await expect(page.getByRole('button', { name: '完成第 2 组' }).first()).toBeVisible()

  // The bench press rests 180 s by default; +15 s takes it above 3:00. Real
  // time keeps running (slowly in WebKit), so the times are checked as ranges.
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  const sheet = page.getByRole('dialog', { name: '组间休息' })
  await expect(sheet.getByRole('timer')).toHaveText(/^(3:00|2:5\d)$/)
  await sheet.getByRole('button', { name: '多休息 15 秒' }).click()
  await expect(sheet.getByRole('timer')).toHaveText(/^3:(0[1-9]|1[0-5])$/)

  // Closing the sheet leaves the rest running in a pill.
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(sheet).toBeHidden()
  const pill = page.getByRole('button', { name: '展开休息计时' })
  await expect(pill).toContainText(/3:(0\d|1[0-5])/)

  // Only the date jumps, as when iOS freezes the app; the clock also keeps
  // running in real time, so allow for the reload itself.
  await page.clock.setSystemTime(Date.now() + 60_000)
  await page.reload()
  await expect(pill).toContainText(/(1:[3-5]\d|2:[01]\d)/)

  // Past its end the pill shows the overdue time; a tap ends the rest.
  await page.clock.setSystemTime(Date.now() + 240_000)
  const over = page.getByRole('button', { name: '停止提示音，结束休息' })
  await expect(over).toContainText(/\+(0:[3-5]\d|1:[01]\d)/)
  await over.click()
  await expect(over).toBeHidden()
  await expect(pill).toBeHidden()
})
