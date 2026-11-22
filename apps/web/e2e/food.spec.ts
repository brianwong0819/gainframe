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
  await expect(meal.getByText('蛋白质 34 g')).toBeVisible()
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
