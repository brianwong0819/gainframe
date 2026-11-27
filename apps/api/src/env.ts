import { z } from 'zod'

const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
})

const envSchema = databaseEnvSchema.extend({
  // The Cognito user pool's issuer and the web app's client (auth.ts).
  AUTH_ISSUER: z.url({ protocol: /^https$/ }),
  AUTH_CLIENT_ID: z.string().min(1),
  // For the `anthropic` AI provider (src/ai/config.ts); without it AI calls fail.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

function parse<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>): T {
  const result = schema.safeParse(source)
  if (!result.success) {
    throw new Error(
      `Invalid environment:\n${z.prettifyError(result.error)}\n` +
        'For local development, copy apps/api/.env.example to apps/api/.env.',
    )
  }
  return result.data
}

/** The API server's environment. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return parse(envSchema, source)
}

/** Only the database, for the migration runner and the integration tests. */
export function parseDatabaseUrl(source: Record<string, string | undefined>): string {
  return parse(databaseEnvSchema, source).DATABASE_URL
}

// In Lambda, secrets stay in SSM Parameter Store; the environment holds only
// the parameter names, and the values are read once per cold start.
const lambdaEnvSchema = z.object({
  DATABASE_URL_PARAMETER: z.string().startsWith('/gainframe/'),
  AUTH_CONFIG_PARAMETER: z.string().startsWith('/gainframe/'),
  ANTHROPIC_API_KEY_PARAMETER: z.string().startsWith('/gainframe/'),
})

// Written by infra/modules/auth as JSON.
const authParameterSchema = z.object({ issuer: z.string(), clientId: z.string() })

export async function loadLambdaEnv(
  source: Record<string, string | undefined>,
  getParameter: (name: string) => Promise<string>,
): Promise<Env> {
  const result = lambdaEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid Lambda environment:\n${z.prettifyError(result.error)}`)
  }
  const [databaseUrl, authConfig, anthropicApiKey] = await Promise.all([
    getParameter(result.data.DATABASE_URL_PARAMETER),
    getParameter(result.data.AUTH_CONFIG_PARAMETER),
    getParameter(result.data.ANTHROPIC_API_KEY_PARAMETER),
  ])
  const auth = authParameterSchema.parse(JSON.parse(authConfig))
  return parseEnv({
    DATABASE_URL: databaseUrl,
    AUTH_ISSUER: auth.issuer,
    AUTH_CLIENT_ID: auth.clientId,
    ANTHROPIC_API_KEY: anthropicApiKey,
  })
}

// The git SHA of the deployed build, included in every log line. CD stamps it
// into the Lambda environment (M0-10); local runs report `local`.
const releaseSchema = z.object({ RELEASE: z.string().min(1).default('local') })

export function readRelease(source: Record<string, string | undefined>): string {
  return releaseSchema.parse(source).RELEASE
}
