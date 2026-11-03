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

// In Lambda, secrets stay in SSM Parameter Store; the environment holds only
// the parameter names, and the values are read once per cold start.
const lambdaEnvSchema = z.object({
  DATABASE_URL_PARAMETER: z.string().startsWith('/gainframe/'),
})

export async function loadLambdaEnv(
  source: Record<string, string | undefined>,
  getParameter: (name: string) => Promise<string>,
): Promise<Env> {
  const result = lambdaEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid Lambda environment:\n${z.prettifyError(result.error)}`)
  }
  return parseEnv({ DATABASE_URL: await getParameter(result.data.DATABASE_URL_PARAMETER) })
}
