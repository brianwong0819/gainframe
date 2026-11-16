import { readFile } from 'node:fs/promises'

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

// ROADMAP M1-11: "Export all data (JSON)" as a backup. On the iPhone the file
// goes to the share sheet; elsewhere it downloads.
test('exports all data through the share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    const shared: string[] = []
    Object.defineProperty(window, '__shared', { value: shared })
    Object.defineProperty(navigator, 'canShare', { value: () => true })
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        for (const file of files) shared.push(`${file.name}\n${await file.text()}`)
      },
    })
  })
  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await expect(page).toHaveURL(/\/workout\/session\/?$/)

  await page.goto('/settings/diagnostics')
  await expect(page.getByTestId('export-counts')).toHaveText('1 次训练 · 0 个计划 · 0 个自定义动作')
  await page.getByRole('button', { name: '导出全部数据（JSON）' }).click()
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(Reflect.get(window, '__shared'), 'length'))))
    .toBe(1)
  const shared = await page.evaluate(() => String(Reflect.get(Reflect.get(window, '__shared'), 0)))
  const [name = '', ...lines] = shared.split('\n')
  expect(name).toMatch(/^gainframe-\d{4}-\d{2}-\d{2}\.json$/)
  const data: unknown = JSON.parse(lines.join('\n'))
  expect(data).toMatchObject({
    format: 'gainframe-export',
    formatVersion: 1,
    release: 'local',
    tables: { workouts: [{ endedAt: null }], plans: [], exercises: [] },
  })
})

test('downloads the export where there is no share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined })
  })
  await page.goto('/settings/diagnostics')
  await expect(page.getByTestId('export-counts')).toHaveText('0 次训练 · 0 个计划 · 0 个自定义动作')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出全部数据（JSON）' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^gainframe-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await file.path()
  const data: unknown = JSON.parse(await readFile(path, 'utf8'))
  expect(data).toMatchObject({ format: 'gainframe-export', tables: { workouts: [] } })
})
