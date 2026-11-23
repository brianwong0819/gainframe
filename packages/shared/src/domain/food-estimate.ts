import { domainConfig } from '../config.ts'
import type { FoodEstimateItem, OilSauce, VisionReply } from '../schemas/food-estimate.ts'
import type { FoodTableEntry } from '../schemas/food-table.ts'

// What makes a model reply unusable even though it matches the output format:
// an entry id the table does not have, or an item without an entry that lacks
// its own figures. The messages go back to the model for its one retry.
export function visionReplyIssues(
  reply: VisionReply,
  hasEntry: (id: string) => boolean,
): { path: (string | number)[]; message: string }[] {
  return reply.items.flatMap((item, index) => {
    const issues: { path: (string | number)[]; message: string }[] = []
    if (item.entryId !== null && !hasEntry(item.entryId)) {
      issues.push({
        path: ['items', index, 'entryId'],
        message: `"${item.entryId}" is not a food table id; use an id from the list or null`,
      })
    }
    if (item.entryId === null && (item.proteinPer100G === null || item.kcalPer100G === null)) {
      issues.push({
        path: ['items', index],
        message: 'An item without an entry needs proteinPer100G and kcalPer100G',
      })
    }
    return issues
  })
}

// The estimate's items with protein and energy for their grams: from the food
// table entry when there is one ("the model looks, the table counts"), else
// from the model's own per-100 g figures. Alternatives keep only known ids,
// without the chosen one or repeats. Figures stay unrounded; screens round.
export function resolveEstimate(
  reply: VisionReply,
  entries: ReadonlyMap<string, FoodTableEntry>,
): FoodEstimateItem[] {
  return reply.items.map((item) => {
    const entry = item.entryId === null ? undefined : entries.get(item.entryId)
    const per100 =
      entry === undefined
        ? { protein: item.proteinPer100G ?? 0, kcal: item.kcalPer100G ?? 0 }
        : { protein: entry.proteinPer100G, kcal: entry.kcalPer100G }
    const alternativeIds = [...new Set(item.alternativeIds)].filter(
      (id) => id !== entry?.id && entries.has(id),
    )
    return {
      name: entry?.nameEn ?? item.seen,
      entryId: entry?.id ?? null,
      grams: item.grams,
      proteinG: (per100.protein * item.grams) / 100,
      kcal: (per100.kcal * item.grams) / 100,
      nutrients: entry === undefined ? 'model' : 'table',
      confidence: item.confidence,
      alternativeIds,
      raw: item,
    }
  })
}

// The energy the oil and sauce choice adds to a meal (negative for "less"),
// from the meal's weight (`domainConfig.oilSauce`).
export function oilSauceKcal(items: readonly { grams: number }[], choice: OilSauce): number {
  if (choice === 'usual') return 0
  const grams = items.reduce((sum, item) => sum + item.grams, 0)
  const { shareOfGrams, kcalPerG } = domainConfig.oilSauce
  return (choice === 'more' ? 1 : -1) * grams * shareOfGrams * kcalPerG
}

// The items with `kcal` added across them in proportion to their energy, so
// the meal's total changes by `kcal` (never below zero for an item).
export function spreadKcal<T extends { kcal: number }>(items: readonly T[], kcal: number): T[] {
  const total = items.reduce((sum, item) => sum + item.kcal, 0)
  if (kcal === 0 || total === 0) return [...items]
  return items.map((item) => ({
    ...item,
    kcal: Math.max(0, item.kcal + (kcal * item.kcal) / total),
  }))
}
