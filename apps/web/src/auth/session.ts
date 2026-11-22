import { z } from 'zod'

// The signed-in session, a device setting (ADR-0007). `userId` is the Cognito
// `sub`, the same value the API reads from the access token. `expired` is set
// when Cognito refuses the refresh token: the device keeps the account and its
// unsent changes, and the app asks the user to sign in again. `method` is how
// the user signed in, shown on the account page. Sessions saved before a field
// existed read as not expired and as email.
export const authSessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
  accessToken: z.string().min(1),
  accessExpiresAt: z.iso.datetime(),
  refreshToken: z.string().min(1),
  expired: z.boolean().default(false),
  method: z.enum(['email', 'google']).default('email'),
})
export type AuthSession = z.infer<typeof authSessionSchema>
