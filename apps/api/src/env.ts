import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(
      `Invalid environment:\n${z.prettifyError(result.error)}\n` +
        'For local development, copy apps/api/.env.example to apps/api/.env.',
    )
  }
  return result.data
}
