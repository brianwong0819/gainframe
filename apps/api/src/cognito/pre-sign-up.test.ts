import type { UserStatusType, UserType } from '@aws-sdk/client-cognito-identity-provider'
import { describe, expect, it } from 'vitest'

import { createLogger } from '../log.ts'
import { type PreSignUpEvent, preSignUp, SignUpRefused } from './pre-sign-up.ts'

const log = createLogger({ release: 'test', write: () => undefined })

function event(triggerSource: string, userName: string, emailVerified = 'true'): PreSignUpEvent {
  return {
    triggerSource,
    userPoolId: 'pool',
    userName,
    request: { userAttributes: { email: 'lifter@example.com', email_verified: emailVerified } },
  }
}

function user(username: string, status: UserStatusType, emailVerified = 'true'): UserType {
  return {
    Username: username,
    UserStatus: status,
    Attributes: [{ Name: 'email_verified', Value: emailVerified }],
  }
}

function directory(users: UserType[]) {
  const links: string[][] = []
  return {
    links,
    usersWithEmail: () => Promise.resolve(users),
    link: (_pool: string, username: string, googleSub: string) => {
      links.push([username, googleSub])
      return Promise.resolve()
    },
  }
}

describe('pre sign-up', () => {
  it('links a first Google sign-in to the confirmed email account with that email', async () => {
    const users = directory([user('email-user', 'CONFIRMED')])
    await preSignUp(event('PreSignUp_ExternalProvider', 'google_1234_5'), users, log)
    expect(users.links).toEqual([['email-user', '1234_5']])
  })

  it('does not link to an account whose email was never verified', async () => {
    const users = directory([
      user('unconfirmed', 'UNCONFIRMED'),
      user('unverified', 'CONFIRMED', 'false'),
    ])
    await preSignUp(event('PreSignUp_ExternalProvider', 'google_1234'), users, log)
    expect(users.links).toEqual([])
  })

  it('does not link when Google reports the email as unverified', async () => {
    const users = directory([user('email-user', 'CONFIRMED')])
    await preSignUp(event('PreSignUp_ExternalProvider', 'google_1234', 'false'), users, log)
    expect(users.links).toEqual([])
  })

  it('refuses an email sign-up for an address that signs in with Google', async () => {
    const users = directory([user('google_1234', 'EXTERNAL_PROVIDER')])
    await expect(preSignUp(event('PreSignUp_SignUp', 'new-user'), users, log)).rejects.toThrow(
      SignUpRefused,
    )
  })

  it('lets a new email sign up', async () => {
    const users = directory([])
    await expect(
      preSignUp(event('PreSignUp_SignUp', 'new-user'), users, log),
    ).resolves.toBeUndefined()
  })
})
