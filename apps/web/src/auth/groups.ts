import { groupsAllowAi } from '@gainframe/shared'
import { z } from 'zod'

const groupsSchema = z.object({ 'cognito:groups': z.array(z.string()).default([]) })

// Whether an access token's Cognito groups allow the AI features, read without
// verifying the token, so only to choose what the screens offer: the API
// verifies the token and enforces the same rule. A malformed token reads as no.
export function tokenAllowsAi(token: string): boolean {
  const payload = token.split('.')[1]
  if (payload === undefined) return false
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const result = groupsSchema.safeParse(json)
    return result.success && groupsAllowAi(result.data['cognito:groups'])
  } catch {
    return false
  }
}
