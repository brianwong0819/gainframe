import { describe, expect, it } from 'vitest'

import { foodTableEntrySchema, type MyfcdRow } from '../schemas/food-table.ts'
import {
  buildFoodTable,
  dedupeMyfcd,
  FOOD_TABLE,
  MYFCD_ROWS,
  myfcdNames,
  SGFOODID_ROWS,
  USDA_ROWS,
} from './food-table.ts'
import { searchByName } from '../domain/name-search.ts'
import { MYFCD_CURATION } from './myfcd-curation.ts'
import { SGFOODID_CURATION } from './sgfoodid-curation.ts'
import { USDA_CURATION } from './usda-curation.ts'

const row = (overrides: Partial<MyfcdRow>): MyfcdRow => ({
  database: 'FCD1997',
  code: '1',
  name: 'Rice, cooked (Nasi)',
  category: 'Cereals',
  ediblePortionG: 100,
  kcal: 130,
  proteinG: 2.3,
  fatG: 0.1,
  carbG: 30,
  servings: [],
  sourceUrl: 'https://myfcd.moh.gov.my/',
  ...overrides,
})

describe('FOOD_TABLE', () => {
  it('matches the entry schema', () => {
    for (const entry of FOOD_TABLE) {
      expect(foodTableEntrySchema.safeParse(entry).error).toBeUndefined()
    }
  })

  it('has unique ids and unique Chinese names', () => {
    expect(new Set(FOOD_TABLE.map((entry) => entry.id)).size).toBe(FOOD_TABLE.length)
    expect(new Set(FOOD_TABLE.map((entry) => entry.nameZh)).size).toBe(FOOD_TABLE.length)
  })

  it('curates every source row, and every curation entry names a source row', () => {
    const myfcdCodes = new Set(dedupeMyfcd(MYFCD_ROWS).map((source) => source.code))
    const usdaIds = new Set(USDA_ROWS.map((source) => String(source.fdcId)))
    expect(new Set(Object.keys(MYFCD_CURATION))).toEqual(myfcdCodes)
    expect(new Set(Object.keys(USDA_CURATION))).toEqual(usdaIds)
    expect(new Set(Object.keys(SGFOODID_CURATION))).toEqual(
      new Set(SGFOODID_ROWS.map((source) => source.code)),
    )
  })

  // A misread page or unit shows as energy far from the protein, fat and
  // carbohydrate it is made of (4, 9 and 4 kcal per gram).
  it('takes only source rows whose energy agrees with their macronutrients', () => {
    // SG FoodID rows whose energy disagrees are left out in their curation.
    const included = SGFOODID_ROWS.filter((row) => !('skip' in (SGFOODID_CURATION[row.code] ?? {})))
    const disagree = [...MYFCD_ROWS, ...USDA_ROWS, ...included].filter(
      ({ kcal, proteinG, fatG, carbG }) => {
        if (proteinG === null || fatG === null || carbG === null) return false
        const atwater = 4 * proteinG + 9 * fatG + 4 * carbG
        return Math.abs(atwater - kcal) > Math.max(25, 0.15 * kcal)
      },
    )
    expect(disagree).toEqual([])
  })

  it('throws on a source row without a curation entry', () => {
    expect(() => buildFoodTable([row({ code: 'unknown' })], [], [])).toThrow('No curation')
  })
})

describe('myfcdNames', () => {
  it.each([
    ['Rice, cooked (Nasi)', 'Rice, cooked', ['Nasi']],
    ['Barley, pearl (Beras Belanda); Hordeum vulgare', 'Barley, pearl', ['Beras Belanda']],
    ['Maize (Jagung) Zea Mays', 'Maize', ['Jagung']],
    ['Walnut, dried; Juglans regia', 'Walnut, dried', []],
    ['(Capati)', 'Capati', []],
    ['BARLEY FLOUR (TEPUNG BARLI)', 'Barley flour', ['Tepung barli']],
    ['Ulam raja (Ulam raja) ; Cosmos caudatus', 'Ulam raja', []],
  ])('reads %s', (raw, en, aliases) => {
    expect(myfcdNames(raw)).toEqual({ en, aliases })
  })
})

describe('dedupeMyfcd', () => {
  it('keeps the 1997 row of a food the newer app repeats', () => {
    const older = row({ code: '101014' })
    const repeat = row({ database: 'myfcd97', code: '101014', name: 'Rice, cooked (Nasi) ' })
    expect(dedupeMyfcd([repeat, older])).toEqual([older])
  })

  it('keeps two foods that share a name but not their figures', () => {
    const product = row({ code: '222003', name: 'Beef burger', kcal: 237 })
    const fastFood = row({ code: '232001', name: 'Beef burger', kcal: 255 })
    expect(dedupeMyfcd([product, fastFood])).toEqual([product, fastFood])
  })
})

describe('searchByName over FOOD_TABLE', () => {
  const first = (query: string) => searchByName(FOOD_TABLE, query)[0]

  it('finds a food by its English, Chinese and Malay names', () => {
    expect(first('chicken breast meat')?.nameZh).toBe('鸡胸肉')
    expect(first('鸡蛋')?.nameEn).toBe('Hen egg, whole')
    expect(first('nasi lemak')?.nameZh).toBe('椰浆饭')
  })

  it('finds everyday Malaysian Chinese food by its local names', () => {
    expect(first('经济饭')?.nameZh).toMatch(/^杂饭/)
    expect(first('char kuey teow')?.nameZh).toMatch(/炒粿条/)
    expect(first('wantan mee')?.nameZh).toMatch(/^云吞面/)
    expect(first('肉骨茶')?.nameZh).toMatch(/肉骨茶/)
    expect(first('pan mee')?.nameZh).toMatch(/板面|面粉粿/)
  })
})
