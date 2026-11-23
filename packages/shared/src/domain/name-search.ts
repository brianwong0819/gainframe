// Anything named in Chinese and English, optionally with aliases: exercises
// and the food table's entries. A custom exercise may lack either name.
interface Searchable {
  nameZh: string | null
  nameEn: string | null
  aliases?: readonly string[]
}

// Case, width, spaces and punctuation do not matter: "Push-up", "pushup" and
// "ＰＵＳＨ ＵＰ" are the same term.
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]/gu, '')
}

function terms(item: Searchable): string[] {
  return [item.nameZh, item.nameEn, ...(item.aliases ?? [])]
    .filter((term) => term !== null)
    .map(normalize)
}

// 0: a name or alias is the query; 1: one starts with it; 2: one contains it;
// 3: every word of the query appears somewhere in the names and aliases; null:
// no match.
function rank(item: Searchable, query: string, words: readonly string[]): number | null {
  const names = terms(item)
  if (names.includes(query)) return 0
  if (names.some((name) => name.startsWith(query))) return 1
  if (names.some((name) => name.includes(query))) return 2
  const all = names.join(' ')
  return words.every((word) => all.includes(word)) ? 3 : null
}

// Items whose Chinese name, English name or aliases match `query`, best match
// first; ties keep their input order. An empty query returns every item.
export function searchByName<T extends Searchable>(items: readonly T[], query: string): T[] {
  const whole = normalize(query)
  if (whole === '') return [...items]
  const words = query
    .split(/\s+/u)
    .map(normalize)
    .filter((word) => word !== '')
  return items
    .map((item, index) => ({ item, index, rank: rank(item, whole, words) }))
    .filter((hit): hit is typeof hit & { rank: number } => hit.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((hit) => hit.item)
}
