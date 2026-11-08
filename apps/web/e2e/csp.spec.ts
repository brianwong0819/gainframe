import { expect, test } from '@playwright/test'

import { pages } from './pages.ts'

// The server sends CloudFront's Content-Security-Policy header and each page
// carries its inline-script hash policy, so a blocked script, style, font or
// request shows up here as a violation, on WebKit and Chromium alike.
for (const { name, path } of pages) {
  test(`${name} runs under the Content-Security-Policy`, async ({ page }) => {
    await page.addInitScript(() => {
      const violations: string[] = []
      Object.assign(window, { cspViolations: violations })
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(`${event.effectiveDirective} blocked ${event.blockedURI || 'inline'}`)
      })
    })
    await page.goto(path, { waitUntil: 'networkidle' })

    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /^script-src 'self'( 'sha256-[A-Za-z0-9+/]+=*')+$/,
    )
    const violations = await page.evaluate(() =>
      'cspViolations' in window ? window.cspViolations : ['the violation listener did not run'],
    )
    expect(violations).toEqual([])
  })
}
