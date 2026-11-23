import type { FoodTableEntry } from '@gainframe/shared'

let loading: Promise<readonly FoodTableEntry[]> | undefined

// The bundled food table is a separate chunk, fetched on the first search on
// the manual screen; the service worker precaches it, so it loads offline too.
// A failed load is forgotten, so the next search tries again.
export function loadFoodTable(): Promise<readonly FoodTableEntry[]> {
  loading ??= import('@gainframe/shared/food-table').then(
    (module) => module.FOOD_TABLE,
    (reason: unknown) => {
      loading = undefined
      throw reason
    },
  )
  return loading
}
