import { z } from 'zod'

import type { createAi } from './ai/generate.ts'
import type { Logger } from './log.ts'

// One real model call through the whole AI pipeline (cap, provider, schema,
// log line), run like the database check: only by a direct invocation, which
// needs `lambda:InvokeFunction`. The deploy smoke test uses it.
export const aiCheckEventSchema = z.strictObject({ check: z.literal('ai') })
export type AiCheckEvent = z.infer<typeof aiCheckEventSchema>

export const isAiCheckEvent = (event: unknown): event is AiCheckEvent =>
  aiCheckEventSchema.safeParse(event).success

const replySchema = z.object({ answer: z.int() })

// Not a real user: the check's calls are counted under this ID.
export const AI_CHECK_USER = 'deploy-check'

export async function checkAi(
  generate: ReturnType<typeof createAi>,
  log: Logger,
): Promise<{ ai: string }> {
  const result = await generate({
    feature: 'check',
    userId: AI_CHECK_USER,
    log,
    system: 'Answer with the JSON the schema asks for.',
    content: [{ type: 'text', text: 'What is 2 + 3?' }],
    schema: replySchema,
  })
  if (!result.ok) return { ai: result.outcome }
  return { ai: result.value.answer === 5 ? 'ok' : 'wrong_answer' }
}
