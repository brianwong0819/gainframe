// `pnpm eval:vision --data <folder>` (ROADMAP M3-08): runs the labelled meals
// through the photo and text estimates on the configured provider
// (`aiConfig.provider`) and writes a Markdown report beside the labels. Needs
// ANTHROPIC_API_KEY in the environment for Anthropic's API, or AWS credentials
// allowed to call Bedrock (`$env:AWS_PROFILE = "gainframe"`) for `bedrock`.
// Options: --models a,b (model IDs of that provider; default: the served model),
// --prompts 2,3 (photo prompt versions; default: the served one), --runs 3,
// --split test|dev|all (default test), --out <file> (default
// <data>/vision-report-<date>.md). Usage: "Evals" in docs/ai.md.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { foodEstimateRequestSchema } from '@gainframe/shared'
import { z } from 'zod'

import { configuredProvider } from '../../src/ai/claude.ts'
import { aiConfig } from '../../src/ai/config.ts'
import { createLogger } from '../../src/log.ts'
import { evaluate } from './evaluate.ts'
import { evalLabelsSchema } from './labels.ts'
import { markdownTable } from './metrics.ts'

// The labels allow only these extensions (labels.ts).
const mediaType = (file: string) => {
  const extension = path.extname(file).toLowerCase()
  return extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
}

const { values } = parseArgs({
  options: {
    data: { type: 'string' },
    models: { type: 'string', default: aiConfig.features.vision.model },
    prompts: { type: 'string', default: String(aiConfig.features.vision.promptVersion) },
    runs: { type: 'string', default: '3' },
    split: { type: 'string', default: 'test' },
    out: { type: 'string' },
  },
})

if (values.data === undefined) throw new Error('Pass --data <folder with labels.json and photos>')
const dataDir = values.data
const split = values.split
if (split !== 'test' && split !== 'dev' && split !== 'all') {
  throw new Error('--split is test, dev or all')
}
const runs = Number(values.runs)
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs is a whole number from 1')
const list = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

const labels = evalLabelsSchema.parse(
  JSON.parse(await readFile(path.join(dataDir, 'labels.json'), 'utf8')),
)
const cases = labels.cases.filter((item) => split === 'all' || item.split === split)
if (cases.length === 0) throw new Error(`No cases in the ${split} split`)

const log = createLogger({ release: 'eval' })
const models = list(values.models)
const promptVersions = list(values.prompts).map(Number)

// A photo as the device would send it, checked against the endpoint's limits.
async function readPhoto(file: string) {
  const base64 = (await readFile(path.join(dataDir, file))).toString('base64')
  return foodEstimateRequestSchema.shape.photo.parse({ type: mediaType(file), base64 })
}

const rows = await evaluate({
  cases,
  readPhoto,
  provider: configuredProvider({
    provider: aiConfig.provider,
    region: aiConfig.region,
    anthropicApiKey: z.string().min(1).optional().parse(process.env.ANTHROPIC_API_KEY),
  }),
  models,
  promptVersions,
  runs,
  log,
})

const date = new Date().toISOString().slice(0, 10)
const report = [
  `# Vision eval, ${date}`,
  '',
  `Split: ${split}, ${String(cases.length)} cases, ${String(runs)} runs per case and model. ` +
    'MAE is the mean absolute error; bias is the mean signed error (positive: too high); ' +
    '±20 % is the share of runs within 20 % of the truth; spread is the mean gap between ' +
    "a case's highest and lowest run. Cost uses first-party list prices (evals/vision/prices.ts).",
  '',
  markdownTable(rows),
  '',
].join('\n')
const out = values.out ?? path.join(dataDir, `vision-report-${date}.md`)
await writeFile(out, report)
log.info('eval report written', { out })
