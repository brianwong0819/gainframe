import { z } from 'zod'

import {
  type FoodTableEntry,
  type MyfcdRow,
  myfcdRowSchema,
  type SgfoodidRow,
  sgfoodidRowSchema,
  type UsdaRow,
  usdaRowSchema,
} from '../schemas/food-table.ts'
import type { FoodCuration } from './curation.ts'
import { MYFCD_CURATION } from './myfcd-curation.ts'
import { SGFOODID_CURATION } from './sgfoodid-curation.ts'
import myfcdJson from './sources/myfcd.json' with { type: 'json' }
import sgfoodidJson from './sources/sgfoodid.json' with { type: 'json' }
import usdaJson from './sources/usda.json' with { type: 'json' }
import { USDA_CURATION } from './usda-curation.ts'

// MyFCD's older app repeats many 1997 foods, under the same code or name and
// with the same figures. Rows are kept in this order, so the first database
// wins a repeat.
const DATABASE_ORDER: readonly MyfcdRow['database'][] = ['FCD1997', 'myfcd97', 'current']

const nameKey = (name: string) => name.split(';')[0]?.trim().toLowerCase().replace(/\s+/g, ' ')

function sentenceCase(text: string): string {
  return text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text
}

// "Rice, cooked (Nasi)" → English "Rice, cooked" and the local name "Nasi".
// The scientific name after ";" or after the last bracket is dropped; a name
// that is only a bracket, such as "(Capati)", is its own English name.
export function myfcdNames(raw: string): { en: string; aliases: string[] } {
  const name = raw.split(';')[0]?.trim() ?? raw
  const match = /^(.*)\(([^()]+)\)[^()]*$/.exec(name)
  if (match === null) return { en: sentenceCase(name), aliases: [] }
  const en = sentenceCase((match[1] ?? '').trim().replace(/,$/, ''))
  const local = sentenceCase((match[2] ?? '').trim())
  if (en === '') return { en: local, aliases: [] }
  return { en, aliases: local.toLowerCase() === en.toLowerCase() ? [] : [local] }
}

export function dedupeMyfcd(rows: readonly MyfcdRow[]): MyfcdRow[] {
  const ordered = rows.toSorted(
    (a, b) => DATABASE_ORDER.indexOf(a.database) - DATABASE_ORDER.indexOf(b.database),
  )
  const kept: MyfcdRow[] = []
  for (const row of ordered) {
    const repeat = kept.some(
      (other) =>
        (other.code === row.code || nameKey(other.name) === nameKey(row.name)) &&
        Math.abs(other.kcal - row.kcal) < 1 &&
        Math.abs(other.proteinG - row.proteinG) < 0.1,
    )
    if (!repeat) kept.push(row)
  }
  return kept
}

function curated(
  curation: Readonly<Record<string, FoodCuration>>,
  code: string,
): Exclude<FoodCuration, { skip: string }> | null {
  const entry = curation[code]
  if (entry === undefined) throw new Error(`No curation for food ${code}`)
  return 'skip' in entry ? null : entry
}

const round1 = (value: number) => Math.round(value * 10) / 10

// Builds the table from the source extracts and their curation. Every source
// row must be curated, so a new extract cannot add an unnamed food.
export function buildFoodTable(
  myfcd: readonly MyfcdRow[],
  usda: readonly UsdaRow[],
  sgfoodid: readonly SgfoodidRow[],
): FoodTableEntry[] {
  const fromMyfcd = dedupeMyfcd(myfcd).flatMap((row): FoodTableEntry[] => {
    const entry = curated(MYFCD_CURATION, row.code)
    if (entry === null) return []
    const names = myfcdNames(row.name)
    return [
      {
        id: `myfcd-${row.code}`,
        nameEn: entry.en ?? names.en,
        nameZh: entry.zh,
        aliases: names.aliases,
        proteinPer100G: round1(row.proteinG),
        kcalPer100G: Math.round(row.kcal),
        servingG: entry.servingG,
        source: 'myfcd',
      },
    ]
  })
  const fromUsda = usda.flatMap((row): FoodTableEntry[] => {
    const entry = curated(USDA_CURATION, String(row.fdcId))
    if (entry === null) return []
    return [
      {
        id: `usda-${String(row.fdcId)}`,
        nameEn: entry.en ?? row.description,
        nameZh: entry.zh,
        aliases: [],
        proteinPer100G: round1(row.proteinG),
        kcalPer100G: Math.round(row.kcal),
        servingG: entry.servingG,
        source: 'usda',
      },
    ]
  })
  const fromSgfoodid = sgfoodid.flatMap((row): FoodTableEntry[] => {
    const entry = curated(SGFOODID_CURATION, row.code)
    if (entry === null) return []
    if (row.proteinG === null) throw new Error(`SG FoodID food ${row.code} has no protein figure`)
    return [
      {
        id: `sgfoodid-${row.code}`,
        nameEn: entry.en ?? row.name,
        nameZh: entry.zh,
        aliases: [...(entry.aliases ?? [])],
        proteinPer100G: round1(row.proteinG),
        kcalPer100G: Math.round(row.kcal),
        servingG: entry.servingG,
        source: 'sgfoodid',
      },
    ]
  })
  return [...fromMyfcd, ...fromUsda, ...fromSgfoodid]
}

export const MYFCD_ROWS = z.array(myfcdRowSchema).parse(myfcdJson)
export const USDA_ROWS = z.array(usdaRowSchema).parse(usdaJson)
export const SGFOODID_ROWS = z.array(sgfoodidRowSchema).parse(sgfoodidJson)

// The bundled Malaysian food table (ROADMAP M3-11): MyFCD first, then USDA
// for the gym staples and cooked meats MyFCD lacks, then SG FoodID for hawker
// dishes, economy rice, kopitiam drinks and kueh.
export const FOOD_TABLE: readonly FoodTableEntry[] = buildFoodTable(
  MYFCD_ROWS,
  USDA_ROWS,
  SGFOODID_ROWS,
)
