import { describe, expect, it } from 'vitest'

import { estimateAiRawSchema } from './food-estimate.ts'

const saved = {
  seen: 'chicken rice',
  entryId: null,
  grams: 300,
  confidence: 'medium',
  alternativeIds: [],
  proteinPer100G: 9,
  kcalPer100G: 180,
  remember: false,
  oilSauce: 'usual',
}

describe('estimateAiRawSchema', () => {
  it('reads items saved before the assumptions line was stored', () => {
    expect(estimateAiRawSchema.safeParse(saved).success).toBe(true)
  })

  it('keeps a text estimate assumptions line, or null for a photo', () => {
    const text = estimateAiRawSchema.parse({ ...saved, assumptions: 'One plate, no egg' })
    expect(text.assumptions).toBe('One plate, no egg')
    expect(estimateAiRawSchema.parse({ ...saved, assumptions: null }).assumptions).toBeNull()
  })

  it('rejects an empty assumptions line', () => {
    expect(estimateAiRawSchema.safeParse({ ...saved, assumptions: '' }).success).toBe(false)
  })
})
