// USD per million tokens, for the report's cost column. First-party list
// prices from Anthropic's model table, checked 2026-11-24; Bedrock bills
// Claude through AWS Marketplace and may differ, so confirm on the Bedrock
// pricing page before choosing a model on cost alone. Claude Haiku 5.5's price
// applies to prompts up to 100,000 tokens; the photo prompt is about 35,000.
// Cache reads cost a tenth of input and cache writes 1.25 times input.
export interface ModelPrice {
  input: number
  output: number
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'anthropic.claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'anthropic.claude-sonnet-5-5': { input: 2, output: 10 },
  'anthropic.claude-opus-5-5': { input: 4, output: 20 },
}

export interface CallTokens {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** The cost of one call in USD, or null for a model without a listed price. */
export function callCost(model: string, tokens: CallTokens): number | null {
  const price = MODEL_PRICES[model]
  if (price === undefined) return null
  const input = tokens.inputTokens + tokens.cacheReadTokens * 0.1 + tokens.cacheWriteTokens * 1.25
  return (input * price.input + tokens.outputTokens * price.output) / 1_000_000
}
