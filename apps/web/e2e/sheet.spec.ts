import { expect, test } from '@playwright/test'

// The sheet must rise from below. A modal dialog is a scroll container, and when
// it scrolled to reveal the panel, the panel appeared at once and then ran off
// the top of the screen (L-023). Every frame of the opening keeps the dialog
// unscrolled, and the panel starts low and ends higher.
test.use({ reducedMotion: 'no-preference', locale: 'zh-CN' })

test('the exercise sheet rises from the bottom without scrolling its dialog', async ({ page }) => {
  await page.goto('/workout/exercises')
  const row = page.locator('main li button').first()
  await row.waitFor()

  // The first sample is taken by a MutationObserver the moment the panel is in
  // an open dialog, before any frame of the animation: a sampler that waits
  // for its first animation frame can start late on a slow runner and find the
  // panel already past the middle of the screen (L-034).
  const frames = page.evaluate(
    () =>
      new Promise<{ scrollTop: number; top: number }[]>((resolve) => {
        const seen: { scrollTop: number; top: number }[] = []
        const read = () => {
          const dialog = document.querySelector<HTMLDialogElement>('.sheet-dialog')
          const panel = document.querySelector('.sheet-panel')
          if (!dialog?.open || !panel) return false
          seen.push({ scrollTop: dialog.scrollTop, top: panel.getBoundingClientRect().top })
          return true
        }
        const sample = () => {
          read()
          if (seen.length < 20) requestAnimationFrame(sample)
          else resolve(seen)
        }
        const observer = new MutationObserver(() => {
          if (!read()) return
          observer.disconnect()
          requestAnimationFrame(sample)
        })
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['open'],
        })
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

// iOS lays the keyboard over the page without shrinking the layout viewport;
// only the visual viewport shrinks. A search that left two results used to
// shrink the picker to the bottom of the screen, under the keyboard, so a
// result could be tapped only after closing the keyboard. The picker keeps
// its height while the search narrows, and the dialog follows the visual
// viewport. The keyboard is stood in for by a shorter visual viewport.
test('the exercise picker keeps its height and stays above the keyboard', async ({ page }) => {
  await page.goto('/workout/plans')
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  const panel = page.locator('.sheet-panel')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')
  const before = await panel.boundingBox()

  // Two built-in exercises match (L-036).
  await page.getByRole('searchbox').fill('前平举')
  const results = page.getByRole('dialog').getByRole('listitem')
  await expect(results).not.toHaveCount(0)
  expect(await panel.boundingBox()).toEqual(before)

  const keyboardTop = await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('no visual viewport')
    const height = Math.round(viewport.height * 0.55)
    Object.defineProperty(viewport, 'height', { get: () => height })
    viewport.dispatchEvent(new Event('resize'))
    return height
  })
  const box = await panel.boundingBox()
  if (box === null) throw new Error('no panel')
  expect(box.y + box.height).toBeLessThanOrEqual(keyboardTop + 1)
  const last = await results.last().boundingBox()
  if (last === null) throw new Error('no result')
  expect(last.y + last.height).toBeLessThanOrEqual(keyboardTop)
})
