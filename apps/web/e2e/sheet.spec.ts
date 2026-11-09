import { expect, test } from '@playwright/test'

// The sheet must rise from below. A modal dialog is a scroll container, and when
// it scrolled to reveal the panel, the panel appeared at once and then ran off
// the top of the screen (L-023). Every frame of the opening keeps the dialog
// unscrolled, and the panel starts low and ends higher.
test.use({ reducedMotion: 'no-preference' })

test('the exercise sheet rises from the bottom without scrolling its dialog', async ({ page }) => {
  await page.goto('/workout/exercises')
  const row = page.locator('main li button').first()
  await row.waitFor()

  const frames = page.evaluate(
    () =>
      new Promise<{ scrollTop: number; top: number }[]>((resolve) => {
        const seen: { scrollTop: number; top: number }[] = []
        const sample = () => {
          const dialog = document.querySelector('.sheet-dialog')
          const panel = document.querySelector('.sheet-panel')
          if (dialog && panel) {
            seen.push({ scrollTop: dialog.scrollTop, top: panel.getBoundingClientRect().top })
          }
          if (seen.length < 20) requestAnimationFrame(sample)
          else resolve(seen)
        }
        requestAnimationFrame(sample)
      }),
  )
  await row.click()
  const seen = await frames

  expect(seen.map((frame) => frame.scrollTop)).toEqual(seen.map(() => 0))
  const first = seen[0]
  const last = seen.at(-1)
  if (first === undefined || last === undefined) throw new Error('no frames sampled')
  const viewport = page.viewportSize()?.height ?? 0
  expect(first.top).toBeGreaterThan(viewport / 2)
  expect(last.top).toBeLessThan(first.top)
})
