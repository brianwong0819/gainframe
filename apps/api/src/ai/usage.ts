import { and, eq, sql } from 'drizzle-orm'

import type { Database } from '../db/client.ts'
import { aiUsage } from '../db/schema.ts'
import type { AiUsage } from './provider.ts'

export interface UsageKey {
  userId: string
  feature: string
  // UTC date, YYYY-MM-DD (see `aiUsage` in db/schema.ts).
  day: string
}

export type UsageStore = ReturnType<typeof usageStore>

export function usageStore(db: Database) {
  const match = (key: UsageKey) =>
    and(eq(aiUsage.userId, key.userId), eq(aiUsage.day, key.day), eq(aiUsage.feature, key.feature))
  return {
    // Counts one call and returns true, or returns false when the cap is
    // reached. One statement, so two concurrent calls cannot both take the last.
    reserve: async (key: UsageKey, cap: number): Promise<boolean> => {
      const rows = await db
        .insert(aiUsage)
        .values({ ...key, calls: 1 })
        .onConflictDoUpdate({
          target: [aiUsage.userId, aiUsage.day, aiUsage.feature],
          set: { calls: sql`${aiUsage.calls} + 1` },
          setWhere: sql`${aiUsage.calls} < ${cap}`,
        })
        .returning({ calls: aiUsage.calls })
      return rows.length > 0
    },
    addTokens: async (key: UsageKey, usage: AiUsage): Promise<void> => {
      await db
        .update(aiUsage)
        .set({
          inputTokens: sql`${aiUsage.inputTokens} + ${usage.inputTokens}`,
          outputTokens: sql`${aiUsage.outputTokens} + ${usage.outputTokens}`,
        })
        .where(match(key))
    },
  }
}
