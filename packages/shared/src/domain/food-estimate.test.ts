import { describe, expect, it } from 'vitest'

import type { VisionItem, VisionReply } from '../schemas/food-estimate.ts'
import type { FoodTableEntry } from '../schemas/food-table.ts'
import { oilSauceKcal, resolveEstimate, spreadKcal, visionReplyIssues } from './food-estimate.ts'

const entry = (overrides: Partial<FoodTableEntry>): FoodTableEntry => ({
  id: 'sgfoodid-F00000001',
  nameEn: 'Chicken rice, roasted',
  nameZh: '烧鸡饭',
  aliases: [],
  proteinPer100G: 8,
  kcalPer100G: 180,
  servingG: 350,
  servingLabel: null,
  source: 'sgfoodid',
  ...overrides,
})

const chickenRice = entry({})
const egg = entry({
  id: 'myfcd-1',
  nameEn: 'Egg, chicken, boiled',
  proteinPer100G: 12.5,
  kcalPer100G: 155,
})
const table = new Map([chickenRice, egg].map((e) => [e.id, e]))

const item = (overrides: Partial<VisionItem>): VisionItem => ({
  seen: 'roast chicken rice',
  entryId: chickenRice.id,
  grams: 350,
  confidence: 'high',
  alternativeIds: [],
  proteinPer100G: null,
  kcalPer100G: null,
  ...overrides,
})

const reply = (...items: VisionItem[]): VisionReply => ({ dishName: 'Chicken rice', items })

describe('resolveEstimate', () => {
  it('computes protein and energy from the table entry and the grams', () => {
    const [rice, boiledEgg] = resolveEstimate(
      reply(item({}), item({ seen: 'egg', entryId: egg.id, grams: 50 })),
      table,
    )
    expect(rice).toMatchObject({
      name: 'Chicken rice, roasted',
      entryId: chickenRice.id,
      grams: 350,
      proteinG: 28,
      kcal: 630,
      nutrients: 'table',
    })
    expect(boiledEgg).toMatchObject({ proteinG: 6.25, kcal: 77.5, nutrients: 'table' })
  })

  it('ignores figures the model gave for an item that has an entry', () => {
    const [rice] = resolveEstimate(reply(item({ proteinPer100G: 30, kcalPer100G: 500 })), table)
    expect(rice).toMatchObject({ proteinG: 28, kcal: 630, nutrients: 'table' })
  })

  it("uses the model's own figures, tagged, when no entry fits", () => {
    const [sambal] = resolveEstimate(
      reply(
        item({
          seen: 'sambal squid',
          entryId: null,
          grams: 80,
          proteinPer100G: 15,
          kcalPer100G: 140,
        }),
      ),
      table,
    )
    expect(sambal).toMatchObject({
      name: 'sambal squid',
      entryId: null,
      proteinG: 12,
      kcal: 112,
      nutrients: 'model',
    })
  })

  it('keeps only known alternatives, without the chosen entry or repeats', () => {
    const [rice] = resolveEstimate(
      reply(item({ alternativeIds: [egg.id, 'usda-999', chickenRice.id, egg.id] })),
      table,
    )
    expect(rice?.alternativeIds).toEqual([egg.id])
  })

  it("keeps the model's item unchanged for storage", () => {
    const raw = item({ alternativeIds: ['usda-999'] })
    expect(resolveEstimate(reply(raw), table)[0]?.raw).toEqual(raw)
  })

  it('returns no items when no food was recognised', () => {
    expect(resolveEstimate({ dishName: null, items: [] }, table)).toEqual([])
  })
})

describe('visionReplyIssues', () => {
  const has = (id: string) => table.has(id)

  it('accepts known entries and items with their own figures', () => {
    const ok = reply(item({}), item({ entryId: null, proteinPer100G: 10, kcalPer100G: 100 }))
    expect(visionReplyIssues(ok, has)).toEqual([])
  })

  it('names an unknown entry id and an item without an entry or figures', () => {
    const bad = reply(item({ entryId: 'sgfoodid-F99999999' }), item({ entryId: null }))
    const issues = visionReplyIssues(bad, has)
    expect(issues.map((issue) => issue.path)).toEqual([
      ['items', 0, 'entryId'],
      ['items', 1],
    ])
    expect(issues[0]?.message).toContain('not a food table id')
    expect(issues[1]?.message).toContain('needs proteinPer100G')
  })
})

describe('oilSauceKcal', () => {
  const meal = [{ grams: 300 }, { grams: 50 }]

  it('adds nothing for the usual oil, which the figures already hold', () => {
    expect(oilSauceKcal(meal, 'usual')).toBe(0)
  })

  it('adds or takes away oil worth 3% of the meal weight at 9 kcal/g', () => {
    expect(oilSauceKcal(meal, 'more')).toBeCloseTo(94.5)
    expect(oilSauceKcal(meal, 'less')).toBeCloseTo(-94.5)
  })
})

describe('spreadKcal', () => {
  it('spreads the energy over the items in proportion to their energy', () => {
    const items = [{ kcal: 600 }, { kcal: 200 }]
    expect(spreadKcal(items, 80).map((item) => item.kcal)).toEqual([660, 220])
  })

  it('never takes an item below zero', () => {
    expect(spreadKcal([{ kcal: 50 }], -80)).toEqual([{ kcal: 0 }])
  })

  it('leaves items without energy as they are', () => {
    expect(spreadKcal([{ kcal: 0 }], 80)).toEqual([{ kcal: 0 }])
  })
})
