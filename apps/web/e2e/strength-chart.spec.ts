import { expect, type Page, test } from '@playwright/test'
import { z } from 'zod'

// ROADMAP M4-06: the strength card of the Progress page, the exercise page
// with its chart, and reading along the chart. The drag is timed per
// animation frame like the weight chart's (L-054, L-056): the 95th percentile
// and the longest frame.
test.use({ locale: 'zh-CN' })

const DAY_MS = 24 * 60 * 60 * 1000
const BENCH = '00000000-0000-7000-8000-000000000001'
// The weight chart's limits; see e2e/weight-chart.spec.ts (L-056).
const P95_FRAME_MS = 50
const STALL_FRAME_MS = 100
const DRAG_STEPS = 40

function uuidv7(ms: number): string {
  const hex = ms.toString(16).padStart(12, '0')
  const random = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16))
  const tail = random.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7${tail.slice(0, 3)}-8${tail.slice(3, 6)}-${tail.slice(6, 18)}`
}

// Twelve bench press workouts, one every six days up to today, the top set
// rising 2.5 kg every third workout; written straight into IndexedDB.
async function seedBench(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '体重' })).toBeVisible()
  const now = Date.now()
  const base = {
    userId: null,
    deletedAt: null,
  }
  const workouts = []
  const slots = []
  const sets = []
  for (let index = 0; index < 12; index += 1) {
    const at = new Date(now - (11 - index) * 6 * DAY_MS - 60 * 60 * 1000)
    const started = at.toISOString()
    const ended = new Date(at.getTime() + 45 * 60 * 1000).toISOString()
    const row = { ...base, createdAt: started, updatedAt: ended }
    const workoutId = uuidv7(at.getTime())
    const slotId = uuidv7(at.getTime() + 1)
    workouts.push({
      ...row,
      id: workoutId,
      startedAt: started,
      endedAt: ended,
      planDayId: null,
      localDate: at.toLocaleDateString('en-CA'),
      note: null,
      restStartedAt: null,
      restEndsAt: null,
    })
    slots.push({
      ...row,
      id: slotId,
      workoutId,
      exerciseId: BENCH,
      position: 0,
      supersetGroup: null,
      note: null,
      repsMin: null,
      repsMax: null,
      restS: null,
      planNote: null,
    })
    for (let position = 0; position < 3; position += 1) {
      sets.push({
        ...row,
        id: uuidv7(at.getTime() + 2 + position),
        workoutExerciseId: slotId,
        workoutId,
        exerciseId: BENCH,
        position,
        kind: 'working',
        weightKg: 60 + Math.floor(index / 3) * 2.5,
        reps: 8 - position,
        rpe: null,
        completedAt: new Date(at.getTime() + (5 + position * 4) * 60 * 1000).toISOString(),
      })
    }
  }
  await page.evaluate(
    (tables) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gainframe')
        open.onerror = () => {
          reject(new Error('IndexedDB did not open'))
        }
        open.onsuccess = () => {
          const names = Object.keys(tables)
          const transaction = open.result.transaction(names, 'readwrite')
          for (const [name, rows] of Object.entries(tables)) {
            for (const row of rows) transaction.objectStore(name).put(row)
          }
          transaction.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      }),
    { workouts, workoutExercises: slots, workoutSets: sets },
  )
}

test('the exercise page charts the best set of each workout and reads it smoothly', async ({
  page,
}) => {
  await seedBench(page)
  await page.goto('/progress')
  await page.getByRole('link', { name: '杠铃卧推 的力量变化' }).click()
  await expect(page).toHaveURL(/\/progress\/exercise#00000000-0000-7000-8000-000000000001$/)
  await expect(page.getByRole('heading', { name: '杠铃卧推', level: 1 })).toBeVisible()
  await expect(page.getByText('练过 12 次')).toBeVisible()

  const card = page
    .locator('section')
    .filter({ has: page.getByRole('img', { name: /每次训练最好的一组/ }) })
  const heading = card.getByRole('heading')
  await expect(heading).toHaveText('估算 1RM · 今天')
  await expect(card.getByText('在涨')).toBeVisible()
  await expect(card).toContainText('67.5 kg × 8')

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
    window.addEventListener('pointerdown', () => frames.push(-1), { capture: true })
    Object.assign(window, { chartFrames: frames })
  })
  await page.mouse.move(box.x + box.width - 2, y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(box.x + box.width - 2 - ((box.width - 4) * step) / DRAG_STEPS, y)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  }
  // At the left edge the hairline is on the first workout: 60 kg × 8.
  await expect(heading).not.toHaveText('估算 1RM · 今天')
  await expect(card).toContainText('60 kg × 8')
  await page.mouse.up()
  await expect(heading).toHaveText('估算 1RM · 今天')

  const frames = z
    .array(z.number())
    .parse(await page.evaluate((): unknown => Reflect.get(window, 'chartFrames')))
    .slice(1)
  const durations = frames.filter((frame) => frame >= 0)
  expect(durations.length).toBeGreaterThanOrEqual(DRAG_STEPS)
  const log = frames.map((frame) => (frame < 0 ? 'down' : String(Math.round(frame)))).join(' ')
  const sorted = durations.toSorted((a, b) => a - b)
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity
  expect(p95, log).toBeLessThan(P95_FRAME_MS)
  expect(Math.max(...durations), log).toBeLessThan(STALL_FRAME_MS)

  await page.getByRole('button', { name: '最重一组' }).click()
  await expect(card.getByRole('heading')).toHaveText('最重一组 · 今天')
  await expect(card.locator('.num.text-title')).toHaveText('67.5')
})

test('an exercise done once shows the first-days state', async ({ page }) => {
  await page.goto('/progress')
  await expect(page.getByText('练过的动作会列在这里，练两次就能看到变化。')).toBeVisible()

  await page.goto('/workout')
  await page.getByRole('button', { name: '开始训练' }).click()
  await page.getByRole('button', { name: '添加动作' }).click()
  await page.getByRole('searchbox').fill('杠铃卧推')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^杠铃卧推/ })
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const weight = page.getByRole('textbox', { name: '第 1 组重量' })
  await weight.fill('40')
  await weight.press('Enter')
  await expect(weight).toHaveValue('40')
  await page.getByRole('main').getByRole('button', { name: '完成第 1 组' }).last().click()
  await expect(page.getByRole('button', { name: '取消完成第 1 组' })).toBeVisible()

  await page.goto('/progress')
  await page.getByRole('link', { name: '杠铃卧推 的力量变化' }).click()
  await expect(page.getByText('再练一次，就能画出变化。')).toBeVisible()
  await expect(page.locator('[data-chart-touch]')).toHaveCount(0)
})
