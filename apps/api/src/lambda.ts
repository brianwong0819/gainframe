// AWS Lambda entry point, bundled by rolldown.config.ts. CloudFront forwards
// `/api/*` to the function URL; the same Hono app runs locally in dev.ts.
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { handle } from '@hono/aws-lambda'

import { createApp } from './app.ts'
import { createPool, pingDatabase } from './db/client.ts'
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

export const handler = handle(createApp({ log, pingDatabase: () => pingDatabase(pool) }))
