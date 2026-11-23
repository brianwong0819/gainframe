// How a source row enters the bundled food table: its display names and a
// typical serving, or the reason it is left out. `en` replaces the English
// name read from the source when that name needs tidying.
export type FoodCuration = { zh: string; servingG: number; en?: string } | { skip: string }
