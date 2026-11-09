import { expect, test } from '@playwright/test'

// A tap on a link must navigate from the service worker's precache, without
// waiting on the network (a gym often has a weak signal). Client-side
// navigation fetches the page payload with a `_rsc` parameter; here every
// payload request that reaches the network fails, so the navigation stays
// client-side only if the worker answers it. A failed payload fetch makes
// Next.js fall back to a full page load, which the window marker detects.
test.use({ serviceWorkers: 'allow' })

test('a link navigates from the precache when the network fails', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Playwright sees service worker requests only in Chromium')

  await page.goto('/workout')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Before the reload, so the link's prefetch cannot fill the router cache.
  await context.route(/[?&]_rsc=/, (route) => route.abort())
  await page.reload()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  await page.evaluate(() => Object.assign(window, { sameDocument: true }))
  await page.locator('a[href="/workout/exercises"]').first().click()

  await expect(page).toHaveURL(/\/workout\/exercises$/)
  expect(await page.evaluate(() => 'sameDocument' in window)).toBe(true)
})
