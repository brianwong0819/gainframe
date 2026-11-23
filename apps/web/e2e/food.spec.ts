import { expect, test } from '@playwright/test'

// ROADMAP M3-02: the daily targets are set on the Food tab, from the day card.
test.use({ locale: 'zh-CN' })

test('setting the daily targets turns the day card into protein to go', async ({ page }) => {
  await page.goto('/food')
  await expect(page.getByText('今天还没有记录饮食。')).toBeVisible()
  await page.getByRole('button', { name: '设定每日目标' }).click()

  const sheet = page.getByRole('dialog', { name: '每日目标' })
  await sheet.getByRole('button', { name: '提高蛋白质目标' }).click()
  await expect(sheet.getByRole('textbox', { name: '蛋白质目标（克）' })).toHaveValue('145')
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(sheet).toBeHidden()

  await expect(page.getByText('还差')).toBeVisible()
  await expect(page.getByRole('button', { name: '修改每日目标' })).toContainText('0 / 145 g')
  await expect(page.getByText('热量 0 / 2,800 kcal')).toBeVisible()

  // The target is stored: it survives a reload.
  await page.reload()
  await expect(page.getByRole('button', { name: '修改每日目标' })).toContainText('0 / 145 g')
})

test('a meal typed from a label is logged, and its food is then one tap away', async ({ page }) => {
  await page.goto('/food')
  await page.getByRole('link', { name: '手动添加' }).click()
  await expect(page).toHaveURL(/\/food\/add\/?$/)
  await expect(page.getByRole('button', { name: '先选食物' })).toBeDisabled()

  await page.getByRole('button', { name: '新建食物' }).click()
  const sheet = page.getByRole('dialog', { name: '新建食物' })
  await sheet.getByLabel('名称').fill('希腊酸奶')
  await sheet.getByLabel('每份克数').fill('150')
  await sheet.getByLabel('蛋白质 g').fill('15')
  await sheet.getByLabel('热量 kcal').fill('100')
  await sheet.getByRole('button', { name: '加入这餐' }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('button', { name: '加一份希腊酸奶' }).click()
  await page.getByRole('button', { name: /^记入.* · 1 项 · 30 g$/ }).click()
  await expect(page).toHaveURL(/\/food\/?$/)
  const meal = page.getByRole('listitem').filter({ hasText: '200 kcal' })
  await expect(meal).toContainText('希腊酸奶')
  await expect(meal).toContainText('蛋白质 30 g')

  // Two portions were logged, so the food comes back as last time's 300 g.
  await page.getByRole('link', { name: '手动添加' }).click()
  await expect(page.getByText('300 g · 蛋白质 30 g · 200 kcal').first()).toBeVisible()
  await page.getByRole('button', { name: '加一份希腊酸奶' }).first().click()
  await expect(page.getByRole('button', { name: /^记入.* · 1 项 · 30 g$/ })).toBeEnabled()
})

// ROADMAP M3-11: a search also lists the bundled food table, one tap adding a serving.
test('a search finds a food table entry, and one tap adds its serving', async ({ page }) => {
  await page.goto('/food/add')
  const tabs = page.getByRole('navigation', { name: '主导航' })
  await expect(tabs).toBeVisible()
  await page.getByRole('searchbox', { name: '搜索食物' }).fill('烤鸡胸肉')
  // While typing, the tab bar gives its room to the results (bw, 2026-11-23).
  await expect(tabs).toBeHidden()
  await expect(page.getByRole('heading', { name: '食物库' })).toBeVisible()
  await expect(page.getByText('120 g · 蛋白质 37 g · 198 kcal').first()).toBeVisible()
  await page.getByRole('button', { name: '加一份烤鸡胸肉', exact: true }).click()

  // The chosen serving stays in view once the search is cleared.
  await page.getByRole('searchbox', { name: '搜索食物' }).fill('')
  await expect(page.getByRole('button', { name: '减一份烤鸡胸肉', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^记入.* · 1 项 · 37 g$/ }).click()
  await expect(page).toHaveURL(/\/food\/?$/)
  await expect(page.getByRole('listitem').filter({ hasText: '198 kcal' })).toContainText('烤鸡胸肉')
})

// ROADMAP M3-12: a food table entry is edited from its name, used from then on,
// and restored to the shipped figures.
test('an edited food table entry is used from then on and can be restored', async ({ page }) => {
  await page.goto('/food/add')
  await page.getByRole('searchbox', { name: '搜索食物' }).fill('乳清蛋白粉')
  await expect(page.getByText('1 勺 · 31 g · 蛋白质 24 g · 109 kcal')).toBeVisible()
  await page.getByRole('button', { name: '编辑乳清蛋白粉', exact: true }).click()

  const sheet = page.getByRole('dialog', { name: '编辑食物' })
  await sheet.getByRole('textbox', { name: '第 1 个份量的克数' }).fill('35')
  await sheet.getByRole('textbox', { name: '热量 kcal' }).fill('130')
  await expect(sheet.getByText('每 100 g：蛋白质 69.1 g · 371 kcal')).toBeVisible()
  await sheet.getByRole('button', { name: '保存' }).click()
  await expect(sheet).toBeHidden()

  // Once the search is cleared the edit is listed under the user's foods.
  await page.getByRole('searchbox', { name: '搜索食物' }).fill('')
  const mine = page.getByRole('list').filter({ hasText: '已修改' })
  await expect(mine).toContainText('1 勺 · 35 g · 蛋白质 24 g · 130 kcal')

  await page.getByRole('button', { name: '编辑乳清蛋白粉', exact: true }).click()
  await sheet.getByRole('button', { name: '恢复默认数据' }).click()
  await sheet.getByRole('button', { name: '再点一次恢复默认' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('已修改')).toBeHidden()
})

// The prerendered dock shows before React attaches its handlers (L-028).
test('"新建食物" opens its sheet even when tapped as soon as it shows', async ({ page }) => {
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue()
  })
  await page.goto('/food/add', { waitUntil: 'commit' })
  await page.getByRole('button', { name: '新建食物' }).click()
  await expect(page.getByRole('dialog', { name: '新建食物' }).getByLabel('名称')).toBeVisible()
})

test('a frequent food is logged in one tap and undone, and a meal is edited', async ({ page }) => {
  await page.goto('/food/add')
  await page.getByRole('button', { name: '新建食物' }).click()
  const sheet = page.getByRole('dialog', { name: '新建食物' })
  await sheet.getByLabel('名称').fill('鸡胸肉')
  await sheet.getByLabel('每份克数').fill('100')
  await sheet.getByLabel('蛋白质 g').fill('31')
  await sheet.getByLabel('热量 kcal').fill('165')
  await sheet.getByRole('button', { name: '加入这餐' }).click()
  await page.getByRole('button', { name: /^记入/ }).click()
  await expect(page).toHaveURL(/\/food\/?$/)
  const meals = page.getByRole('list').filter({ hasText: '鸡胸肉' }).last()
  await expect(meals.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('button', { name: '记一份鸡胸肉' }).click()
  await expect(page.getByText('已记入 鸡胸肉')).toBeVisible()
  await expect(meals.getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(meals.getByRole('listitem')).toHaveCount(1)

  await meals.getByRole('button').first().click()
  const meal = page.getByRole('dialog', { name: '鸡胸肉' })
  await meal.getByRole('button', { name: '增加鸡胸肉' }).click()
  await expect(meal.getByRole('textbox', { name: '鸡胸肉的克数' })).toHaveValue('110')
  await expect(meal.getByRole('textbox', { name: '鸡胸肉的蛋白质 g' })).toHaveValue('34.1')

  // A figure corrected by hand is kept, and the day's protein follows it.
  const protein = meal.getByRole('textbox', { name: '鸡胸肉的蛋白质 g' })
  await protein.fill('40')
  await protein.press('Enter')
  await expect(protein).toHaveValue('40')
  await meal.getByRole('button', { name: '关闭' }).click()
  await expect(meals.getByText('蛋白质 40 g')).toBeVisible()
})

test('Today suggests a frequent food for the protein gap and logs it in one tap', async ({
  page,
}) => {
  await page.goto('/food/add')
  await page.getByRole('button', { name: '新建食物' }).click()
  const sheet = page.getByRole('dialog', { name: '新建食物' })
  await sheet.getByLabel('名称').fill('鸡胸肉')
  await sheet.getByLabel('每份克数').fill('100')
  await sheet.getByLabel('蛋白质 g').fill('31')
  await sheet.getByLabel('热量 kcal').fill('165')
  await sheet.getByRole('button', { name: '加入这餐' }).click()
  await page.getByRole('button', { name: /^记入/ }).click()
  await expect(page).toHaveURL(/\/food\/?$/)

  await page.getByRole('link', { name: '今天' }).click()
  await page.getByRole('button', { name: '设定每日目标' }).click()
  await page.getByRole('dialog', { name: '每日目标' }).getByRole('button', { name: '关闭' }).click()
  await expect(page.getByText('用你常吃的补上')).toBeHidden()

  // Any change stores the targets: 140 g less 31 g eaten leaves 109 g.
  await page.getByRole('button', { name: '设定每日目标' }).click()
  const targets = page.getByRole('dialog', { name: '每日目标' })
  await targets.getByRole('button', { name: '提高蛋白质目标' }).click()
  await targets.getByRole('button', { name: '降低蛋白质目标' }).click()
  await targets.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByText('用你常吃的补上')).toBeVisible()
  await expect(page.getByText('109', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '记一份鸡胸肉' }).click()
  await expect(page.getByText('78', { exact: true })).toBeVisible()
})

test('the calculator fills the daily targets from a few answers', async ({ page }) => {
  await page.goto('/food')
  await page.getByRole('button', { name: '设定每日目标' }).click()
  const sheet = page.getByRole('dialog', { name: '每日目标' })
  await sheet.getByRole('button', { name: /^帮我算/ }).click()

  // A man of 22 and 170 cm, the calculator's start, at 62 kg: resting energy
  // 1,578 × 1.55 + 300 = 2,746, to the nearest 50; 62 kg × 2.0 g = 124, to the nearest 5.
  const weight = sheet.getByRole('textbox', { name: '体重 · 公斤' })
  await weight.click()
  await weight.fill('62')
  await weight.press('Enter')
  await expect(sheet.getByText('蛋白质 125 g')).toBeVisible()
  await expect(sheet.getByText('热量 2,750 kcal')).toBeVisible()
  await expect(sheet.getByText('热量 = 基础代谢 1,578 × 活动系数 1.55 +300 kcal')).toBeVisible()

  await sheet.getByRole('button', { name: '减脂' }).click()
  await expect(sheet.getByText('热量 2,050 kcal')).toBeVisible()
  await sheet.getByRole('button', { name: '增肌' }).click()
  await sheet.getByRole('button', { name: '用这个目标' }).click()

  await expect(sheet.getByRole('textbox', { name: '蛋白质目标（克）' })).toHaveValue('125')
  await expect(sheet.getByRole('textbox', { name: '热量目标（千卡）' })).toHaveValue('2750')
  await sheet.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('button', { name: '修改每日目标' })).toContainText('0 / 125 g')

  // The answers are kept: the calculator opens again where they were left.
  await page.getByRole('button', { name: '修改每日目标' }).click()
  await sheet.getByRole('button', { name: /^帮我算/ }).click()
  await expect(sheet.getByRole('textbox', { name: '体重 · 公斤' })).toHaveValue('62')
})

// ROADMAP M3-06: a photo chosen on the Food tab opens the estimate screen,
// shrunk on the device. This build has no sign-in, so the screen explains why
// an account is needed and offers the manual screen instead.
const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGM40ROAFTEMpAQAKq9OwUUQEEcAAAAASUVORK5CYII=',
  'base64',
)

test('a meal photo opens the estimate screen, which asks to sign in first', async ({ page }) => {
  await page.goto('/food')
  await page
    .getByLabel('拍照')
    .setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: photo })
  await expect(page).toHaveURL(/\/food\/photo\/?$/)
  await expect(page.getByRole('img', { name: '这餐的照片' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '登录后才能拍照估算' })).toBeVisible()
  await expect(page.getByRole('link', { name: '登录' })).toBeVisible()
  await page.getByRole('link', { name: '不等了，手动输入' }).click()
  await expect(page).toHaveURL(/\/food\/add\/?$/)
})
