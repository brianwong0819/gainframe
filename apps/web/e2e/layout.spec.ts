import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { deviceMatrix } from './devices.ts'
import type { SafeArea } from './devices.ts'
import { pages } from './pages.ts'

const schemes = ['light', 'dark'] as const

/** Replaces the env() insets in tokens.css with the device's real values. */
async function simulateSafeArea(page: Page, safeArea: SafeArea): Promise<void> {
  await page.addStyleTag({
    content: `:root {
      --safe-top: ${String(safeArea.top)}px !important;
      --safe-right: ${String(safeArea.right)}px !important;
      --safe-bottom: ${String(safeArea.bottom)}px !important;
      --safe-left: ${String(safeArea.left)}px !important;
    }`,
  })
}

/**
 * Content elements (text, images, controls) that sit in a safe-area inset,
 * where the status bar, Dynamic Island or home indicator would cover them.
 * Decorative layers (`aria-hidden`) may extend into the insets.
 */
function elementsInInsets(page: Page, safeArea: SafeArea): Promise<string[]> {
  return page.evaluate((inset) => {
    const width = document.documentElement.clientWidth
    const height = window.innerHeight
    const content = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
      (element) =>
        !element.closest('[aria-hidden="true"]') &&
        (element.matches('img, svg, input, button, select, textarea, [role="button"]') ||
          [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
          )),
    )
    return content
      .filter((element) => {
        // A horizontal scroller (a row of filter chips) clips what is scrolled
        // out of view; only the visible part counts. The scroller itself is
        // checked like any other element.
        const visible = (box: DOMRect) => {
          let left = box.left
          let right = box.right
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (getComputedStyle(parent).overflowX === 'visible') continue
            const clip = parent.getBoundingClientRect()
            left = Math.max(left, clip.left)
            right = Math.min(right, clip.right)
          }
          return {
            top: box.top,
            bottom: box.bottom,
            left,
            right,
            width: right - left,
            height: box.height,
          }
        }
        const box = visible(element.getBoundingClientRect())
        if (box.width <= 0 || box.height === 0) return false
        const fixed = ['fixed', 'sticky'].includes(getComputedStyle(element).position)
        return (
          box.top < inset.top ||
          box.left < inset.left ||
          box.right > width - inset.right ||
          // Scrolling content may pass under the home indicator; fixed bars may not.
          (fixed && box.bottom > height - inset.bottom)
        )
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 40)}"`,
      )
  }, safeArea)
}

for (const { name, path, parent } of pages) {
  for (const scheme of schemes) {
    test(`${name} (${scheme}) fits the screen`, async ({ page }, testInfo) => {
      const device = deviceMatrix.find((entry) => entry.name === testInfo.project.name)
      if (!device) throw new Error(`No device named ${testInfo.project.name}`)
      const { safeArea } = device
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(path)
      await simulateSafeArea(page, safeArea)
      await page.evaluate(() => document.fonts.ready)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, 'horizontal scroll').toBe(0)
      expect(await elementsInInsets(page, safeArea), 'content under a safe-area inset').toEqual([])
      // Every page below a tab has a visible way back (L-025).
      if (parent !== undefined) {
        await expect(page.locator(`a[data-back-link][href="${parent}"]`)).toBeVisible()
      }

      // Review aid: the screenshot shades the insets the device would cover.
      await page.addStyleTag({
        content: `html::after {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
          border-style: solid; border-color: rgb(255 0 80 / 0.25);
          border-width: ${String(safeArea.top)}px ${String(safeArea.right)}px ${String(safeArea.bottom)}px ${String(safeArea.left)}px;
        }`,
      })
      await testInfo.attach(`${name}-${scheme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    })
  }
}
