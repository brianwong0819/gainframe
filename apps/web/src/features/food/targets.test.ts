import { describe, expect, it } from 'vitest'

import { parseKcalTarget, parseProteinTarget } from './targets'

describe('typed daily targets', () => {
  it('reads protein with a point or a comma', () => {
    expect(parseProteinTarget('140')).toBe(140)
    expect(parseProteinTarget(' 142,5 ')).toBe(142.5)
  })

  it('reads energy as whole kcal', () => {
    expect(parseKcalTarget('2800')).toBe(2800)
    expect(parseKcalTarget('2800.5')).toBeNull()
  })

  it('rejects empty, zero, negative, oversized and non-numeric text', () => {
    for (const text of ['', ' ', '0', '-5', '1001', 'abc']) {
      expect(parseProteinTarget(text)).toBeNull()
    }
    for (const text of ['', '0', '-100', '20001', 'abc']) {
      expect(parseKcalTarget(text)).toBeNull()
    }
  })
})
