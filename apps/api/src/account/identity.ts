import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'

import type { DeleteIdentity } from '../routes/account.ts'

// The user pool ID is the last segment of the issuer
// (https://cognito-idp.<region>.amazonaws.com/<pool id>).
export function userPoolIdOf(issuer: string): string {
  const id = new URL(issuer).pathname.split('/').at(-1)
  if (id === undefined || id === '') throw new Error('issuer names no user pool')
  return id
}

// Deletes a Cognito user with AdminDeleteUser. The API's role may call it on
// its own environment's pool only (infra/modules/auth). A user already gone
// counts as deleted, so a retried deletion succeeds.
export function cognitoIdentityDeleter(issuer: string): DeleteIdentity {
  const client = new CognitoIdentityProviderClient({})
  const userPoolId = userPoolIdOf(issuer)
  return async (username) => {
    try {
      await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }))
    } catch (error) {
      if (!(error instanceof UserNotFoundException)) throw error
    }
  }
}
