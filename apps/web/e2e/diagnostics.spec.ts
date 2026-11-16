import { expect, test } from '@playwright/test'

// ROADMAP M1-11: bw has no Web Inspector on the iPhone, so the app shows and
// copies its own errors. The clipboard is replaced with a recorder, because
// WebKit in Playwright grants no clipboard permission.
test.use({ locale: 'zh-CN' })

test('an error thrown in the app is listed in Diagnostics and copied', async ({ page }) => {
  await page.addInitScript(() => {
    const copied: string[] = []
    Object.defineProperty(window, '__copied', { value: copied })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          copied.push(text)
          return Promise.resolve()
        },
      },
    })
  })
  await page.goto('/')
  await page.getByRole('link', { name: '设置' }).click()
  await expect(page).toHaveURL(/\/settings\/?$/)
  await page.getByRole('link', { name: /^诊断/ }).click()
  await expect(page).toHaveURL(/\/settings\/diagnostics\/?$/)
  await expect(page.getByText('没有错误记录。')).toBeVisible()
  await expect(page.getByTestId('release')).toHaveText('local')

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('Diagnostics e2e failure')
    })
  })
  await expect(page.getByText('Diagnostics e2e failure')).toBeVisible()
  await expect(page.getByRole('heading', { name: '最近错误（1）' })).toBeVisible()

  await page.getByRole('button', { name: '复制' }).click()
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible()
  const copied = await page.evaluate(() => {
    const recorded: unknown = Reflect.get(window, '__copied')
    return Array.isArray(recorded) ? recorded.map(String) : []
  })
  expect(copied).toHaveLength(1)
  expect(copied[0]).toContain('Release: local')
  expect(copied[0]).toContain('error /settings/diagnostics (release local)')
  expect(copied[0]).toContain('Diagnostics e2e failure')
})

test('the language setting lives in Settings', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Today' }).first().click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})
