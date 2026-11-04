import type { LambdaContext } from '@hono/aws-lambda'

import type { Logger } from './log.ts'

// The Hono environment shared by the app and its route modules.
export interface AppEnv {
  // Set by @hono/aws-lambda in Lambda; absent under the Node dev server and in tests.
  Bindings: { lambdaContext?: Pick<LambdaContext, 'awsRequestId'> }
  Variables: { requestId: string; log: Logger }
}
