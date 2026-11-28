import {
  type FoodEstimateItem,
  reestimatedFigures,
  textEstimateResponseSchema,
} from '@gainframe/shared'

import { api } from '@/sync/backup'

export type Refigured = Pick<FoodEstimateItem, 'grams' | 'proteinG' | 'kcal' | 'nutrients'>

// The figures for an estimated item the user renamed to a food the library
// does not have ("Correcting a name" in docs/design-system.md): the name and
// the portion go to the text estimate (POST /api/food/estimate-text), and its
// items are scaled to the portion. Null when there is no answer to use
// (offline, signed out, capped, failed or no food named); the caller keeps the
// earlier figures.
export async function reestimateByName(
  name: string,
  grams: number,
  locale: 'zh' | 'en',
): Promise<Refigured | null> {
  if (api === null) return null
  try {
    const response = await api.request(textEstimateResponseSchema, {
      method: 'POST',
      path: '/api/food/estimate-text',
      body: { text: `${name} ${String(Math.round(grams))} g`, locale, answers: [] },
    })
    return reestimatedFigures(grams, response.items)
  } catch {
    return null
  }
}
