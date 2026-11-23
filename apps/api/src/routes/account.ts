import { Hono } from 'hono'

import { deleteUserRows } from '../account/delete.ts'
import type { AppEnv } from '../context.ts'
import type { Database } from '../db/client.ts'

// Deletes the sign-in identity (Cognito AdminDeleteUser in Lambda). Resolves
// when the identity is gone, including when it was already gone.
export type DeleteIdentity = (username: string) => Promise<void>

// DELETE /api/account (M2-10): every row of the signed-in user, then the
// Cognito user. Rows go first: if the identity cannot be deleted, the user can
// still sign in and try again, whereas the other order could leave rows that no
// one can reach. Both steps are idempotent. The user comes from the token.
export function accountRoutes(db: Database, deleteIdentity: DeleteIdentity) {
  return new Hono<AppEnv>().delete('/', async (c) => {
    const { userId, username } = c.var
    if (userId === undefined || username === undefined) {
      throw new Error('account route reached without requireUser')
    }
    const removed = await deleteUserRows(db, userId)
    await deleteIdentity(username)
    c.var.log.info('account deleted', {
      userId,
      rows: Object.values(removed).reduce((sum, count) => sum + count, 0),
    })
    return c.body(null, 204)
  })
}
