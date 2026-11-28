import { expect, type Page, test } from '@playwright/test'

// ROADMAP M4-07: the protein card of the Progress page and the protein page.
// Fourteen past days are seeded straight into IndexedDB: protein alternates
// between 150 g and 100 g against a 140 g target, and one day has no meal.
test.use({ locale: 'zh-CN' })

const DAY_MS = 24 * 60 * 60 * 1000

function uuidv7(ms: number): string {
  const hex = ms.toString(16).padStart(12, '0')
  const random = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16))
  const tail = random.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7${tail.slice(0, 3)}-8${tail.slice(3, 6)}-${tail.slice(6, 18)}`
}

async function put(page: Page, tables: Record<string, unknown[]>) {
  await page.evaluate(
    (values) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gainframe')
        open.onerror = () => {
          reject(new Error('IndexedDB did not open'))
        }
        open.onsuccess = () => {
          const transaction = open.result.transaction(Object.keys(values), 'readwrite')
          for (const [name, rows] of Object.entries(values)) {
            for (const row of rows) transaction.objectStore(name).put(row)
          }
          transaction.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      }),
    tables,
  )
}

async function seed(page: Page, withTargets: boolean) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '体重' })).toBeVisible()
  const now = Date.now()
  const base = { userId: null, deletedAt: null }
  const meals = []
  const items = []
  // Days 1 to 14 before today; day 3 has no meal.
  for (let ago = 1; ago <= 14; ago += 1) {
    if (ago === 3) continue
    const at = new Date(now - ago * DAY_MS)
    const instant = at.toISOString()
    const mealId = uuidv7(at.getTime())
    meals.push({
      ...base,
      id: mealId,
      createdAt: instant,
      updatedAt: instant,
      eatenAt: instant,
      localDate: at.toLocaleDateString('en-CA'),
      mealType: 'lunch',
      name: null,
      photoKey: null,
    })
    items.push({
      ...base,
      id: uuidv7(at.getTime() + 1),
      createdAt: instant,
      updatedAt: instant,
      mealId,
      position: 0,
      name: 'Chicken rice',
      grams: 500,
      proteinG: ago % 2 === 0 ? 150 : 100,
      kcal: 2600,
      source: 'manual',
      aiRaw: null,
    })
  }
  const instant = new Date(now - 20 * DAY_MS).toISOString()
  const profiles = withTargets
    ? [
        {
          ...base,
          id: uuidv7(now - 20 * DAY_MS),
          createdAt: instant,
          updatedAt: instant,
          proteinMode: 'fixed',
          proteinValue: 140,
          kcalTarget: 2800,
          sex: null,
          birthYear: null,
          heightCm: null,
          activityLevel: null,
          phase: 'bulk',
        },
      ]
    : []
  await put(page, { meals, mealItems: items, profiles })
}

test('the protein card counts the days on target and opens the protein page', async ({ page }) => {
  await seed(page, true)
  await page.goto('/progress')
  const card = page.getByRole('link', { name: /蛋白质 · 近 14 天/ })
  // Even days ago (2, 4, … 14) met the target: seven of thirteen logged days.
  await expect(card).toContainText('7/ 13 天达标')
  await expect(card).toContainText('平均每天少吃 200 kcal')
  await card.click()
  await expect(page).toHaveURL(/\/progress\/protein$/)

  const protein = page
    .locator('section')
    .filter({ has: page.getByRole('img', { name: /每天的蛋白质/ }) })
  await expect(protein).toContainText('每天差 13 g · 平均 127 g · 目标 140 g')
  const bars = protein.getByRole('button', { name: /，/ })
  await expect(bars).toHaveCount(14)
  // The last column is yesterday: 100 g, short of the target.
  await bars.last().click()
  await expect(protein.locator('.num.text-title')).toHaveText('100')
  await expect(protein).toContainText('差 40 g')
  const energy = page
    .locator('section')
    .filter({ has: page.getByRole('img', { name: '每天的热量和目标线' }) })
  await expect(energy.locator('.num.text-title')).toHaveText('2,600')
  await bars.last().click()
  await expect(protein.locator('.num.text-title')).toHaveText('7')

  await page.getByRole('button', { name: '4 周' }).click()
  await expect(protein.getByRole('button', { name: /，/ })).toHaveCount(28)
  await expect(page.getByText('没记').first()).toBeVisible()
})

test('the protein card asks for targets first', async ({ page }) => {
  await seed(page, false)
  await page.goto('/progress')
  await expect(page.getByText('设好每日蛋白质和热量目标，这里就能看每天够不够。')).toBeVisible()
  await expect(page.getByRole('link', { name: '去设目标' })).toHaveAttribute('href', '/food')
})
