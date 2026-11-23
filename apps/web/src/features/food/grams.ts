import { mealItemSchema } from '@gainframe/shared'

// One tap on an item's gram stepper, on the meal sheet and the confirm screen
// (design-system.md, "Food logging").
export const GRAM_STEP = 10

// Typed grams, or null for anything the item schema would reject.
export function parseGrams(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '') return null
  return mealItemSchema.shape.grams.safeParse(value).success ? value : null
}
