// AWS Lambda entry point, bundled by rolldown.config.ts. CloudFront forwards
// `/api/*` to the function URL; the same Hono app runs locally in dev.ts. A
// direct invocation with `{ "check": "database" }` runs the database check,
// and `{ "check": "ai" }` one real model call.
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { handle, type LambdaContext, type LambdaEvent } from '@hono/aws-lambda'

import { cognitoIdentityDeleter } from './account/identity.ts'
import { type AiCheckEvent, checkAi, isAiCheckEvent } from './ai-check.ts'
import { configuredProvider } from './ai/claude.ts'
import { aiConfig } from './ai/config.ts'
import { createAi } from './ai/generate.ts'
import { usageStore } from './ai/usage.ts'
import { createApp } from './app.ts'
import { createKeyCache, fetchJwks, requireUser } from './auth.ts'
import { checkDatabase, type DatabaseCheckEvent, isDatabaseCheckEvent } from './database-check.ts'
import { createDatabase, createPool, pingDatabase } from './db/client.ts'
import { loadLambdaEnv, readRelease } from './env.ts'
import { createLogger } from './log.ts'

// Bounds the cold-start read so a slow SSM call fails instead of using up the function timeout.
const SSM_TIMEOUT_MS = 3000

const ssm = new SSMClient({})

async function getParameter(name: string): Promise<string> {
  const { Parameter } = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
    { abortSignal: AbortSignal.timeout(SSM_TIMEOUT_MS) },
  )
  if (Parameter?.Value === undefined) {
    throw new Error(`SSM parameter ${name} has no value`)
  }
  return Parameter.Value
}

const log = createLogger({ release: readRelease(process.env) })
const env = await loadLambdaEnv(process.env, getParameter)
const pool = createPool(env.DATABASE_URL, log)

const db = createDatabase(pool)
const generate = createAi({
  provider: configuredProvider({
    provider: aiConfig.provider,
    region: aiConfig.region,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  }),
  usage: usageStore(db),
})

const auth = { issuer: env.AUTH_ISSUER, clientId: env.AUTH_CLIENT_ID }
const http = handle(
  createApp({
    log,
    requireUser: requireUser(auth, createKeyCache(fetchJwks(auth.issuer))),
    db,
    deleteIdentity: cognitoIdentityDeleter(auth.issuer),
    generate,
  }),
)

export const handler = (
  event: LambdaEvent | DatabaseCheckEvent | AiCheckEvent,
  context: LambdaContext,
) => {
  const requestLog = log.child({ requestId: context.awsRequestId })
  if (isDatabaseCheckEvent(event)) return checkDatabase(() => pingDatabase(pool), requestLog)
  if (isAiCheckEvent(event)) return checkAi(generate, requestLog)
  return http(event, context)
}
