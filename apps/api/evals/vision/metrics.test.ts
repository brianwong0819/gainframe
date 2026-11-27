import { describe, expect, it } from 'vitest'

import { markdownTable, summarize } from './metrics.ts'

const truth = { proteinG: 40, kcal: 800 }

describe('eval figures', () => {
  it('report error, signed bias, the share within 20 % and the spread of runs', () => {
    const summary = summarize([
      {
        caseId: 'a',
        truth,
        runs: [
          { ok: true, proteinG: 44, kcal: 1000, costUsd: 0.004 },
          { ok: true, proteinG: 36, kcal: 900, costUsd: 0.006 },
          { ok: false, outcome: 'timeout' },
        ],
      },
      { caseId: 'b', truth, runs: [{ ok: true, proteinG: 50, kcal: 800, costUsd: 0.005 }] },
    ])
    expect(summary).toMatchObject({ cases: 2, runs: 4, failedRuns: 1, costPerCall: 0.005 })
    expect(summary.protein?.meanAbsError).toBeCloseTo((4 + 4 + 10) / 3)
    expect(summary.protein?.bias).toBeCloseTo((4 - 4 + 10) / 3)
    // 44 and 36 are within 8 g of 40; 50 is not.
    expect(summary.protein?.within20).toBeCloseTo(2 / 3)
    expect(summary.protein?.spread).toBeCloseTo((8 + 0) / 2)
    // 1000 is 25 % over 800; 900 and 800 are within.
    expect(summary.kcal?.within20).toBeCloseTo(2 / 3)
    expect(summary.kcal?.bias).toBeCloseTo((200 + 100 + 0) / 3)
  })

  it('leave the figures empty when every run failed', () => {
    const summary = summarize([{ caseId: 'a', truth, runs: [{ ok: false, outcome: 'refused' }] }])
    expect(summary).toMatchObject({ protein: null, kcal: null, costPerCall: null, failedRuns: 1 })
    expect(markdownTable([{ label: 'Photo', summary }])).toContain('| Photo | 1 | 1 / 1 | – |')
  })

  it('print bias with its sign, so too high and too low stand apart', () => {
    const summary = summarize([
      { caseId: 'a', truth, runs: [{ ok: true, proteinG: 30, kcal: 900, costUsd: null }] },
    ])
    const table = markdownTable([{ label: 'Baseline', summary }])
    expect(table).toContain('| −10.0 |')
    expect(table).toContain('| +100 |')
    expect(table.split('\n')).toHaveLength(3)
  })
})
