// Cognito pre sign-up trigger: one account per email across email and Google
// sign-in (bw's choice, 2026-11-22; ADR-0007). A first Google sign-in whose
// verified email belongs to a confirmed email account is linked to that
// account instead of creating a second user. Cognito still fails that first
// attempt with "Already found an entry for username"; the web app signs in
// again once, which then returns the existing account
// (https://repost.aws/questions/QUgWVkIodQS1W3Yj8MYjInbA).
// An email sign-up for an address that already signs in with Google is
// refused, since Cognito cannot link in that direction.
import type { UserType } from '@aws-sdk/client-cognito-identity-provider'
import { z } from 'zod'

import type { Logger } from '../log.ts'

export const GOOGLE_PROVIDER = 'Google'

// Thrown to refuse a sign-up; managed login shows the message to the user.
export class SignUpRefused extends Error {
  constructor() {
    super('This email signs in with Google. Go back and choose Continue with Google.')
    this.name = 'SignUpRefused'
  }
}

// The fields of the trigger event this handler reads.
export const preSignUpEventSchema = z.object({
  triggerSource: z.string(),
  userPoolId: z.string(),
  userName: z.string(),
  request: z.object({ userAttributes: z.record(z.string(), z.string()) }),
})
export type PreSignUpEvent = z.infer<typeof preSignUpEventSchema>

export interface Directory {
  usersWithEmail: (userPoolId: string, email: string) => Promise<UserType[]>
  link: (userPoolId: string, username: string, googleSub: string) => Promise<void>
}

const attribute = (user: UserType, name: string) =>
  user.Attributes?.find((entry) => entry.Name === name)?.Value

// Only an account whose owner proved the email may receive a Google identity;
// otherwise anyone could sign up with someone else's address and later
// receive that person's Google sign-ins.
const isConfirmedEmailAccount = (user: UserType) =>
  user.UserStatus === 'CONFIRMED' && attribute(user, 'email_verified') === 'true'

export async function preSignUp(
  event: PreSignUpEvent,
  directory: Directory,
  log: Logger,
): Promise<void> {
  const { email, email_verified: emailVerified } = event.request.userAttributes
  if (email === undefined) return

  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    // Cognito names a federated user `<provider>_<subject>`, e.g. google_1234.
    const separator = event.userName.indexOf('_')
    const provider = event.userName.slice(0, separator)
    if (provider.toLowerCase() !== GOOGLE_PROVIDER.toLowerCase() || emailVerified !== 'true') {
      return
    }
    const users = await directory.usersWithEmail(event.userPoolId, email)
    const target = users.find(isConfirmedEmailAccount)
    if (target?.Username === undefined) return
    await directory.link(event.userPoolId, target.Username, event.userName.slice(separator + 1))
    log.info('google identity linked to an email account')
    return
  }

  if (event.triggerSource === 'PreSignUp_SignUp') {
    const users = await directory.usersWithEmail(event.userPoolId, email)
    if (users.some((user) => user.UserStatus === 'EXTERNAL_PROVIDER')) {
      log.info('email sign-up refused: the address signs in with google')
      throw new SignUpRefused()
    }
  }
}
