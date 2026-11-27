import { expect, type Page, test } from '@playwright/test'
import { z } from 'zod'

// ROADMAP M4-04: reading along the weight chart. bw has no Mac for the
// Safari timeline, so the drag is measured here: every animation frame during
// the drag is timed, and a long one fails the test (WebKit in CI).
test.use({ locale: 'zh-CN' })

const DAY_MS = 24 * 60 * 60 * 1000
const LONG_FRAME_MS = 50
const DRAG_STEPS = 40

// A UUIDv7 for a seeded row: the millisecond time, the version and variant
// bits, and random bits.
function uuidv7(ms: number): string {
  const hex = ms.toString(16).padStart(12, '0')
  const random = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16))
  const tail = random.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7${tail.slice(0, 3)}-8${tail.slice(3, 6)}-${tail.slice(6, 18)}`
}

// Thirty mornings ending today, rising about 0.04 kg a day, written straight
// into IndexedDB once the app has created it.
async function seedWeighIns(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '体重' })).toBeVisible()
  const now = Date.now()
  const rows = Array.from({ length: 30 }, (_, index) => {
    const at = new Date(now - (29 - index) * DAY_MS)
    const localDate = at.toLocaleDateString('en-CA')
    const instant = at.toISOString()
    return {
      id: uuidv7(at.getTime()),
      userId: null,
      createdAt: instant,
      updatedAt: instant,
      deletedAt: null,
      measuredAt: instant,
      localDate,
      weightKg: Math.round((62 + index * 0.04 + (index % 3) * 0.2) * 10) / 10,
      bodyFatPct: null,
      skeletalMuscleKg: null,
      fatMassKg: null,
      source: 'manual',
    }
  })
  await page.evaluate(
    (values) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gainframe')
        open.onerror = () => {
          reject(new Error('IndexedDB did not open'))
        }
        open.onsuccess = () => {
          const transaction = open.result.transaction('bodyMetrics', 'readwrite')
          for (const row of values) transaction.objectStore('bodyMetrics').put(row)
          transaction.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      }),
    rows,
  )
}

test('dragging along the weight chart reads each day without a long frame', async ({ page }) => {
  await seedWeighIns(page)
  await page.getByRole('link', { name: /^进度/ }).click()
  await page.getByRole('link', { name: /体重 · 7 日平均/ }).click()
  await expect(page).toHaveURL(/\/progress\/weight$/)
  const card = page.locator('section').filter({ has: page.getByRole('img', { name: /体重趋势/ }) })
  const heading = card.getByRole('heading')
  await expect(heading).toHaveText('今天 · 7 日平均')

  const touch = card.locator('[data-chart-touch]')
  const box = await touch.boundingBox()
  if (box === null) throw new Error('the chart has no touch area')
  const y = box.y + box.height / 2

  await page.evaluate(() => {
    const frames: number[] = []
    let last = performance.now()
    const tick = (now: number) => {
      frames.push(now - last)
      last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    Object.assign(window, { chartFrames: frames })
  })
  await page.mouse.move(box.x + box.width - 2, y)
  await page.mouse.down()
  // One move per animation frame, as a finger reports them, from the right
  // edge to the left.
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(box.x + box.width - 2 - ((box.width - 4) * step) / DRAG_STEPS, y)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  }
  // At the left edge the hairline is on the first day of the range.
  await expect(heading).not.toHaveText('今天 · 7 日平均')
  await expect(card).toContainText('当天称重')
  await page.mouse.up()
  await expect(heading).toHaveText('今天 · 7 日平均')

  const frames = z
    .array(z.number())
    .parse(await page.evaluate((): unknown => Reflect.get(window, 'chartFrames')))
    .slice(1)
  expect(frames.length).toBeGreaterThanOrEqual(DRAG_STEPS)
  // The message lists every frame, so a failure shows where the long one fell.
  expect(Math.max(...frames), frames.map(Math.round).join(' ')).toBeLessThan(LONG_FRAME_MS)
})

// Before seven weigh-ins the Progress page shows the first-days card: the
// latest weigh-in, how many more days the average needs, and the button.
test('the Progress page counts down to the 7-day average', async ({ page }) => {
  await page.goto('/progress')
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '体重' }) })
  await card.getByRole('button', { name: '记今天体重' }).click()
  await page.getByRole('dialog', { name: '记体重' }).getByRole('button', { name: /^记下/ }).click()
  await expect(page.getByRole('heading', { name: '体重 · 最近一次' })).toBeVisible()
  await expect(page.getByText('已记 1 天')).toBeVisible()
  await expect(page.getByText('再记 6 天，就能算出 7 日平均和每周涨了多少。')).toBeVisible()
})
