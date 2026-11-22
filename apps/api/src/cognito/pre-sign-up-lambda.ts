// Lambda entry point of the Cognito pre sign-up trigger (pre-sign-up.ts),
// bundled by rolldown.config.ts. Cognito waits up to 5 seconds for it.
import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import type { LambdaContext } from '@hono/aws-lambda'

import { readRelease } from '../env.ts'
import { createLogger, errorFields } from '../log.ts'
import {
  type Directory,
  GOOGLE_PROVIDER,
  preSignUp,
  preSignUpEventSchema,
  SignUpRefused,
} from './pre-sign-up.ts'

const client = new CognitoIdentityProviderClient({})
const log = createLogger({ release: readRelease(process.env) })

const directory: Directory = {
  async usersWithEmail(userPoolId, email) {
    // The filter is a quoted string; an email cannot hold a double quote
    // that Cognito accepted, but escape it anyway.
    const { Users } = await client.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${email.replaceAll('"', '\\"')}"`,
        Limit: 10,
      }),
    )
    return Users ?? []
  },
  async link(userPoolId, username, googleSub) {
    await client.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: userPoolId,
        DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: username },
        SourceUser: {
          ProviderName: GOOGLE_PROVIDER,
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: googleSub,
        },
      }),
    )
  },
}

export async function handler(
  event: unknown,
  context: Pick<LambdaContext, 'awsRequestId'>,
): Promise<unknown> {
  const requestLog = log.child({ requestId: context.awsRequestId })
  try {
    await preSignUp(preSignUpEventSchema.parse(event), directory, requestLog)
  } catch (error) {
    // A refusal is an answer, not a fault; Cognito shows its message.
    if (!(error instanceof SignUpRefused))
      requestLog.error('pre sign-up failed', errorFields(error))
    throw error
  }
  // Cognito expects the event back, unchanged.
  return event
}
