import { expect, type Page, test } from '@playwright/test'
import { z } from 'zod'

// ROADMAP M4-04: reading along the weight chart. bw has no Mac for the
// Safari timeline, so the drag is measured here: every animation frame during
// the drag is timed (WebKit in CI). A shared CI runner drops a stray frame now
// and then, so the test judges the 95th percentile and fails outright only on
// a frame a person would see as a stall (L-054). A redraw of the page on each
// move makes most frames long and fails the percentile.
test.use({ locale: 'zh-CN' })
// DIAGNOSTIC ONLY, never merged: where do the slow frames of the drag come from?

const DAY_MS = 24 * 60 * 60 * 1000
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


async function record(page: Page, x0: number, x1: number, y: number, label: string) {
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
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(x0 + ((x1 - x0) * step) / DRAG_STEPS, y)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  }
  await page.mouse.up()
  const frames = z
    .array(z.number())
    .parse(await page.evaluate((): unknown => Reflect.get(window, 'chartFrames')))
    .slice(1)
  const sorted = frames.toSorted((a, b) => a - b)
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
  console.log(
    `DIAG ${test.info().project.name} ${label} p95=${String(Math.round(p95))} max=${String(Math.round(Math.max(...frames)))} :: ${frames.map((f) => String(Math.round(f))).join(' ')}`,
  )
}

test('diagnose drag frames', async ({ page }) => {
  await seedWeighIns(page)
  await page.getByRole('link', { name: /^进度/ }).click()
  await page.getByRole('link', { name: /体重 · 7 日平均/ }).click()
  await expect(page).toHaveURL(/\/progress\/weight$/)
  const card = page.locator('section').filter({ has: page.getByRole('img', { name: /体重趋势/ }) })
  await expect(card.getByRole('heading')).toHaveText('今天 · 7 日平均')
  const box = await card.locator('[data-chart-touch]').boundingBox()
  if (box === null) throw new Error('no touch area')
  const title = await page.getByRole('heading', { level: 1 }).boundingBox()
  if (title === null) throw new Error('no title')
  const right = box.x + box.width - 2
  const left = box.x + 2
  // 1. Same drag over the page title, which reads nothing, right after load.
  await record(page, right, left, title.y + title.height / 2, 'dead-area-at-load')
  // 2. The chart drag right after that.
  await record(page, right, left, box.y + box.height / 2, 'chart-first')
  // 3. The chart drag again, warm.
  await record(page, right, left, box.y + box.height / 2, 'chart-second')
  // 5. The chart drag with the header left unchanged: hairline only.
  await page.evaluate(() => Object.assign(window, { diagNoHeader: true }))
  await record(page, right, left, box.y + box.height / 2, 'chart-hairline-only')
  await record(page, right, left, box.y + box.height / 2, 'chart-hairline-only-2')
  await page.evaluate(() => Object.assign(window, { diagNoHeader: false }))
  await record(page, right, left, box.y + box.height / 2, 'chart-with-header-3')
  // 4. Dead area again, warm.
  await record(page, right, left, title.y + title.height / 2, 'dead-area-warm')
})
