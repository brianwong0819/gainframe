import { describe, expect, it } from 'vitest'

import { FOOD_TABLE } from '@gainframe/shared/food-table'

import { fakeProvider, reply } from '../../src/ai/fake.ts'
import { createLogger } from '../../src/log.ts'
import { baselineTotals, evaluate } from './evaluate.ts'
import { type EvalCase, evalLabelsSchema } from './labels.ts'

const [rice, egg] = FOOD_TABLE
if (rice === undefined || egg === undefined) throw new Error('The food table is empty')

const log = createLogger({ release: 'test', write: () => undefined })
const photo = { type: 'image/jpeg' as const, base64: 'AAAA' }

const meal = (id: string, extra: Partial<EvalCase> = {}): EvalCase => ({
  id,
  split: 'test',
  photo: `${id}.jpg`,
  locale: 'en',
  proteinG: 20,
  kcal: 500,
  entryIds: [rice.id],
  ...extra,
})

// A model reply naming the first table entry at `grams`.
const estimate = (grams: number) =>
  reply(
    JSON.stringify({
      dishName: null,
      photoIssue: null,
      items: [
        {
          seen: 'rice',
          entryId: rice.id,
          grams,
          confidence: 'high',
          alternativeIds: [],
          proteinPer100G: null,
          kcalPer100G: null,
        },
      ],
    }),
  )

const textEstimate = (grams: number) =>
  reply(
    JSON.stringify({
      ...JSON.parse(estimate(grams).text),
      assumptions: 'One plate.',
      questions: [],
    }),
  )

describe('pnpm eval:vision', () => {
  it('validates the labels: unique ids and photo files only', () => {
    expect(evalLabelsSchema.safeParse({ cases: [meal('a'), meal('a')] }).success).toBe(false)
    expect(evalLabelsSchema.safeParse({ cases: [meal('a', { photo: 'a.heic' })] }).success).toBe(
      false,
    )
    expect(evalLabelsSchema.parse({ cases: [meal('a')] }).cases).toHaveLength(1)
  })

  it('counts the baseline at each entry default serving and rejects an unknown id', () => {
    expect(baselineTotals([rice.id, egg.id])).toEqual({
      proteinG: (rice.proteinPer100G * rice.servingG + egg.proteinPer100G * egg.servingG) / 100,
      kcal: (rice.kcalPer100G * rice.servingG + egg.kcalPer100G * egg.servingG) / 100,
    })
    expect(() => baselineTotals(['no-such-food'])).toThrow('no-such-food')
  })

  it('runs every case three times per model through the API pipeline, then the text set', async () => {
    const provider = fakeProvider([
      // Haiku, photo: case a three times, case b three times (one invalid twice).
      estimate(200),
      estimate(250),
      estimate(300),
      reply('not json'),
      reply('still not json'),
      estimate(100),
      estimate(100),
      // Haiku, text: case b only has a description.
      textEstimate(150),
      textEstimate(150),
      textEstimate(150),
    ])
    const rows = await evaluate({
      cases: [meal('a'), meal('b', { description: 'A plate of rice' })],
      readPhoto: () => Promise.resolve(photo),
      provider,
      models: ['anthropic.claude-haiku-5-5'],
      promptVersions: [2],
      runs: 3,
      log,
    })

    expect(rows.map((row) => row.label)).toEqual([
      'Photo · anthropic.claude-haiku-5-5 · vision v2',
      'Text · anthropic.claude-haiku-5-5',
      'Baseline · default servings, no AI',
    ])
    const [photoRow, textRow, baselineRow] = rows
    expect(photoRow?.summary).toMatchObject({ cases: 2, runs: 6, failedRuns: 1 })
    // Each call names the chosen model and carries the photo.
    expect(
      provider.requests.every((request) => request.model === 'anthropic.claude-haiku-5-5'),
    ).toBe(true)
    expect(provider.requests[0]?.messages[0]?.content[0]).toMatchObject({ type: 'image' })
    // Figures come from the table: 200 g of the entry, and so on.
    const proteinAt = (grams: number) => (rice.proteinPer100G * grams) / 100
    expect(photoRow?.summary.protein?.spread).toBeCloseTo((proteinAt(300) - proteinAt(200)) / 2)
    // The fake's 100 input and 20 output tokens per call at Haiku's price.
    expect(photoRow?.summary.costPerCall).toBeCloseTo((100 * 0.1 + 20 * 0.5) / 1_000_000)
    expect(textRow?.summary).toMatchObject({ cases: 1, runs: 3, failedRuns: 0 })
    expect(baselineRow?.summary).toMatchObject({ cases: 2, runs: 2, costPerCall: null })
  })
})
