import { z } from 'zod'

// The signed-in session, a device setting (ADR-0007). `userId` is the Cognito
// `sub`, the same value the API reads from the access token.
export const authSessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
  accessToken: z.string().min(1),
  accessExpiresAt: z.iso.datetime(),
  refreshToken: z.string().min(1),
})
export type AuthSession = z.infer<typeof authSessionSchema>
