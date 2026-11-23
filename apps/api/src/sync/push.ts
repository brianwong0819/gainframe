// Push (ADR-0003): each row is upserted by `id` when its `updatedAt` is later
// than the stored one (last writer wins), and ignored otherwise, so a replayed
// batch changes nothing. Applied rows take the user's next `server_version`.
import {
  BUILT_IN_EXERCISES,
  type PushRequest,
  type PushResult,
  syncConfig,
  type SyncedTableName,
  syncedRowSchemas,
} from '@gainframe/shared'
import { and, eq, getTableColumns, inArray, sql, type SQLChunk } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { z } from 'zod'

import type { Database } from '../db/client.ts'
import { deletedUsers, syncedTables, syncState } from '../db/schema.ts'

type SyncedRow = z.output<(typeof syncedRowSchemas)[SyncedTableName]>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

interface Candidate {
  index: number
  table: SyncedTableName
  row: SyncedRow
}

const builtInExerciseIds = new Set(BUILT_IN_EXERCISES.map((exercise) => exercise.id))

function issuePaths(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))]
}

// Schema and clock checks, which need no database. `userId` replaces whatever
// the client sent: the push schema has no user field (ADR-0003).
function checkRow(
  { table, row }: PushRequest['rows'][number],
  userId: string,
  now: Date,
): { ok: true; row: SyncedRow } | { ok: false; result: PushResult } {
  const parsed = syncedRowSchemas[table].safeParse({ ...row, userId })
  if (!parsed.success) {
    return {
      ok: false,
      result: { status: 'rejected', reason: 'invalid', issues: issuePaths(parsed.error) },
    }
  }
  if (Date.parse(parsed.data.updatedAt) > now.getTime() + syncConfig.clockSkewMs) {
    return {
      ok: false,
      result: { status: 'rejected', reason: 'clock_skew', issues: ['updatedAt'] },
    }
  }
  return { ok: true, row: parsed.data }
}

const rowKey = (table: SyncedTableName, id: string) => `${table}/${id}`

async function storedRows(tx: Transaction, candidates: Candidate[]) {
  const stored = new Map<string, { userId: string; updatedAt: string }>()
  for (const table of new Set(candidates.map((candidate) => candidate.table))) {
    const columns = syncedTables[table]
    const ids = candidates.filter((c) => c.table === table).map((c) => c.row.id)
    const rows = await tx
      .select({ id: columns.id, userId: columns.userId, updatedAt: columns.updatedAt })
      .from(columns)
      .where(inArray(columns.id, ids))
    for (const row of rows) stored.set(rowKey(table, row.id), row)
  }
  return stored
}

// Custom exercises the rows refer to that the user already has (deleted ones
// included, since past sets keep pointing at them).
async function ownExercises(tx: Transaction, userId: string, candidates: Candidate[]) {
  const ids = candidates.flatMap(({ row }) =>
    'exerciseId' in row && !builtInExerciseIds.has(row.exerciseId) ? [row.exerciseId] : [],
  )
  if (ids.length === 0) return new Set<string>()
  const { exercises } = syncedTables
  const rows = await tx
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.userId, userId), inArray(exercises.id, ids)))
  return new Set(rows.map((row) => row.id))
}

// One statement per table. Every column but the key and the owner takes the
// pushed value; the guard repeats the checks made under the lock, so a row can
// never move to another user or back in time. Built as SQL because the table
// varies at run time; each value goes through its column's encoder.
async function upsert(tx: Transaction, table: SyncedTableName, rows: Record<string, unknown>[]) {
  const target = syncedTables[table]
  const columns = Object.entries(getTableColumns<PgTable>(target))
  const list = (parts: SQLChunk[]) => sql.join(parts, sql`, `)
  const names = list(columns.map(([, column]) => sql.identifier(column.name)))
  const values = list(
    rows.map(
      (row) => sql`(${list(columns.map(([key, column]) => sql.param(row[key] ?? null, column)))})`,
    ),
  )
  const updates = list(
    columns
      .filter(([key]) => key !== 'id' && key !== 'userId')
      .map(([, { name }]) => sql`${sql.identifier(name)} = excluded.${sql.identifier(name)}`),
  )
  await tx.execute(sql`
    insert into ${target} (${names}) values ${values}
    on conflict (id) do update set ${updates}
    where ${target.userId} = excluded.user_id and ${target.updatedAt} < excluded.updated_at`)
}

// The pushing user's account was deleted; the route answers 401, which the
// app treats as a sign-in that no longer works.
export class AccountDeletedError extends Error {
  constructor() {
    super('account deleted')
    this.name = 'AccountDeletedError'
  }
}

export async function pushRows(
  db: Database,
  userId: string,
  rows: PushRequest['rows'],
  now: Date,
): Promise<PushResult[]> {
  const results: PushResult[] = []
  const candidates: Candidate[] = []
  rows.forEach((pushed, index) => {
    const checked = checkRow(pushed, userId, now)
    if (checked.ok) candidates.push({ index, table: pushed.table, row: checked.row })
    else results[index] = checked.result
  })
  if (candidates.length === 0) return results

  await db.transaction(async (tx) => {
    // Locks the user's sync state until commit, so one user's pushes run one at
    // a time and the checks below cannot race another push.
    const [state] = await tx
      .insert(syncState)
      .values({ userId, serverVersion: 0 })
      .onConflictDoUpdate({
        target: syncState.userId,
        set: { serverVersion: sql`${syncState.serverVersion}` },
      })
      .returning({ serverVersion: syncState.serverVersion })
    if (state === undefined) throw new Error('sync state upsert returned no row')
    // Checked under the lock, which a deletion also takes: a token can outlive
    // its account by up to an hour (M2-10), and the push must not bring the
    // account's rows back.
    const [deleted] = await tx
      .select({ userId: deletedUsers.userId })
      .from(deletedUsers)
      .where(eq(deletedUsers.userId, userId))
    if (deleted !== undefined) throw new AccountDeletedError()
    let version = state.serverVersion

    const stored = await storedRows(tx, candidates)
    const knownExercises = await ownExercises(tx, userId, candidates)
    const writes = new Map<SyncedTableName, Map<string, Record<string, unknown>>>()

    // Exercises first, so a set may refer to an exercise created in the same batch.
    const ordered = [...candidates].sort(
      (a, b) => Number(b.table === 'exercises') - Number(a.table === 'exercises'),
    )
    for (const { index, table, row } of ordered) {
      const key = rowKey(table, row.id)
      const previous = stored.get(key)
      if (previous !== undefined && previous.userId !== userId) {
        results[index] = { status: 'rejected', reason: 'not_owned', issues: ['id'] }
      } else if (
        previous !== undefined &&
        Date.parse(row.updatedAt) <= Date.parse(previous.updatedAt)
      ) {
        results[index] = { status: 'ignored' }
      } else if (
        'exerciseId' in row &&
        !builtInExerciseIds.has(row.exerciseId) &&
        !knownExercises.has(row.exerciseId)
      ) {
        results[index] = { status: 'rejected', reason: 'unknown_exercise', issues: ['exerciseId'] }
      } else {
        version += 1
        stored.set(key, { userId, updatedAt: row.updatedAt })
        if (table === 'exercises') knownExercises.add(row.id)
        const tableWrites = writes.get(table) ?? new Map<string, Record<string, unknown>>()
        tableWrites.set(row.id, { ...row, serverVersion: version })
        writes.set(table, tableWrites)
        results[index] = { status: 'applied' }
      }
    }

    if (version === state.serverVersion) return
    await tx.update(syncState).set({ serverVersion: version }).where(eq(syncState.userId, userId))
    for (const [table, tableWrites] of writes) await upsert(tx, table, [...tableWrites.values()])
  })
  return results
}
