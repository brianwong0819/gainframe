import { z } from 'zod'

// Per-feature model settings ("Models and cost" in docs/ai.md). Each feature's
// model is chosen with its eval; prompt versions are files in
// `apps/api/prompts/<feature>/v<N>.md`.
// A model added here is also added to `ai_models` in infra/modules/api, which
// the Lambda's permission to call Bedrock is limited to.
const featureSchema = z.object({
  // A Bedrock model ID; see "Bedrock model availability" in docs/ai.md.
  model: z.string().min(1),
  effort: z.enum(['low', 'medium', 'high']),
  maxTokens: z.int().positive(),
  // For one attempt; a retry gets the same again. Two attempts stay under
  // CloudFront's 30 s origin timeout and the Lambda's (infra/modules/api).
  timeoutMs: z.int().positive(),
  // Calls per user and UTC day, counted before each call (`ai_usage`).
  dailyCap: z.int().positive(),
  promptVersion: z.int().positive(),
})

export type AiFeatureConfig = z.infer<typeof featureSchema>

export const aiConfig = z
  .object({
    region: z.string().min(1),
    // Remembered corrections sent with a photo estimate as reference.
    visionCorrectionsMax: z.int().min(0),
    features: z.object({ vision: featureSchema, check: featureSchema }),
  })
  .parse({
    region: 'ap-southeast-1',
    visionCorrectionsMax: 8,
    features: {
      vision: {
        model: 'global.anthropic.claude-haiku-5-5',
        effort: 'low',
        maxTokens: 2048,
        timeoutMs: 12_000,
        dailyCap: 20,
        promptVersion: 1,
      },
      // The deploy's one real call (ai-check.ts); its cap covers a busy day of deploys.
      check: {
        model: 'global.anthropic.claude-haiku-5-5',
        effort: 'low',
        maxTokens: 256,
        timeoutMs: 12_000,
        dailyCap: 50,
        promptVersion: 1,
      },
    },
  })

export type AiFeature = keyof typeof aiConfig.features
