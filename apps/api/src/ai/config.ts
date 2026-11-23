import { z } from 'zod'

// Per-feature model settings ("Models and cost" in docs/ai.md). Each feature's
// model is chosen with its eval; prompt versions are files in
// `apps/api/prompts/<feature>/v<N>.md`.
const featureSchema = z.object({
  // A Bedrock model ID; see "Bedrock model availability" in docs/ai.md.
  model: z.string().min(1),
  effort: z.enum(['low', 'medium', 'high']),
  maxTokens: z.int().positive(),
  // For one attempt; a retry gets the same again.
  timeoutMs: z.int().positive(),
  // Calls per user and UTC day, counted before each call (`ai_usage`).
  dailyCap: z.int().positive(),
  promptVersion: z.int().positive(),
})

export type AiFeatureConfig = z.infer<typeof featureSchema>

export const aiConfig = z
  .object({
    region: z.string().min(1),
    features: z.object({ vision: featureSchema }),
  })
  .parse({
    region: 'ap-southeast-1',
    features: {
      vision: {
        model: 'global.anthropic.claude-haiku-5-5',
        effort: 'low',
        maxTokens: 2048,
        timeoutMs: 30_000,
        dailyCap: 20,
        promptVersion: 1,
      },
    },
  })

export type AiFeature = keyof typeof aiConfig.features
