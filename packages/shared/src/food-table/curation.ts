// How a source row enters the bundled food table: its display names and a
// typical serving, or the reason it is left out. `en` replaces the English
// name read from the source when that name needs tidying; `aliases` adds local
// names to search by ("Char kuey teow", "经济饭").
export type FoodCuration =
  { zh: string; servingG: number; en?: string; aliases?: readonly string[] } | { skip: string }
