// The eval's figures (docs/ai.md, "Evals"): pure functions over the runs, so
// the report can be tested without a model.

export interface Truth {
  proteinG: number
  kcal: number
}

// One run of one case: the logged totals, or the outcome that gave none.
export type RunResult =
  | { ok: true; proteinG: number; kcal: number; costUsd: number | null }
  | { ok: false; outcome: string }

export interface CaseRuns {
  caseId: string
  truth: Truth
  runs: readonly RunResult[]
}

export interface NutrientSummary {
  // Mean absolute error in grams or kcal over every successful run.
  meanAbsError: number
  // Mean signed error: positive means the estimate was too high, which makes
  // a bulking user eat too little.
  bias: number
  // Share of successful runs within ±20 % of the truth.
  within20: number
  // Mean over cases of the gap between the highest and lowest run.
  spread: number
}

export interface Summary {
  cases: number
  runs: number
  failedRuns: number
  protein: NutrientSummary | null
  kcal: NutrientSummary | null
  // Mean over successful runs with a price; null when there is none.
  costPerCall: number | null
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

function nutrientSummary(cases: readonly CaseRuns[], field: keyof Truth): NutrientSummary | null {
  const errors: number[] = []
  const spreads: number[] = []
  let within = 0
  for (const { truth, runs } of cases) {
    const values = runs.flatMap((run) => (run.ok ? [run[field]] : []))
    if (values.length === 0) continue
    for (const value of values) {
      const error = value - truth[field]
      errors.push(error)
      // A truth of zero protein counts as within only when the estimate is zero too.
      const allowed = Math.abs(truth[field]) * 0.2
      if (Math.abs(error) <= allowed) within += 1
    }
    spreads.push(Math.max(...values) - Math.min(...values))
  }
  if (errors.length === 0) return null
  return {
    meanAbsError: mean(errors.map(Math.abs)),
    bias: mean(errors),
    within20: within / errors.length,
    spread: mean(spreads),
  }
}

export function summarize(cases: readonly CaseRuns[]): Summary {
  const runs = cases.flatMap((item) => item.runs)
  const costs = runs.flatMap((run) => (run.ok && run.costUsd !== null ? [run.costUsd] : []))
  return {
    cases: cases.length,
    runs: runs.length,
    failedRuns: runs.filter((run) => !run.ok).length,
    protein: nutrientSummary(cases, 'proteinG'),
    kcal: nutrientSummary(cases, 'kcal'),
    costPerCall: costs.length === 0 ? null : mean(costs),
  }
}

// One row of the report: what was run and its summary.
export interface ReportRow {
  label: string
  summary: Summary
}

const fixed = (value: number, digits: number) => value.toFixed(digits)
const signed = (value: number, digits: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${fixed(Math.abs(value), digits)}`
const percent = (share: number) => `${fixed(share * 100, 0)} %`

function cells(summary: NutrientSummary | null, digits: number): string[] {
  if (summary === null) return ['–', '–', '–', '–']
  return [
    fixed(summary.meanAbsError, digits),
    signed(summary.bias, digits),
    percent(summary.within20),
    fixed(summary.spread, digits),
  ]
}

/** The report as a Markdown table, one row per run setting and the baseline. */
export function markdownTable(rows: readonly ReportRow[]): string {
  const header = [
    'Run',
    'Cases',
    'Failed runs',
    'Protein MAE (g)',
    'Protein bias (g)',
    'Protein ±20 %',
    'Protein spread (g)',
    'Energy MAE (kcal)',
    'Energy bias (kcal)',
    'Energy ±20 %',
    'Energy spread (kcal)',
    'Cost per call (USD)',
  ]
  const lines = rows.map(({ label, summary }) => [
    label,
    String(summary.cases),
    `${String(summary.failedRuns)} / ${String(summary.runs)}`,
    ...cells(summary.protein, 1),
    ...cells(summary.kcal, 0),
    summary.costPerCall === null ? '–' : fixed(summary.costPerCall, 4),
  ])
  return [header, header.map(() => '---'), ...lines]
    .map((line) => `| ${line.join(' | ')} |`)
    .join('\n')
}
