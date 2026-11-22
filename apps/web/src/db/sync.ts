// The device side of sync (ADR-0003): which outbox rows to push next, which
// entries a push settles, and how a pulled page is applied. Only src/sync calls
// these; the network side lives there.
import {
  type PushResult,
  syncedRowSchemas,
  type SyncedTableName,
  syncedTableNameSchema,
} from '@gainframe/shared'
import { z } from 'zod'

import type { GainframeDb } from './schema'

interface SyncedRow {
  id: string
  updatedAt: string
}

// One row to push, with the highest outbox `seq` read for it: entries up to that
// seq are settled by the push, later ones are changes made while it was sent.
export interface PushEntry {
  table: SyncedTableName
  rowId: string
  maxSeq: number
  row: Record<string, unknown>
}

const keyOf = (table: string, rowId: string) => `${table} ${rowId}`

function syncedTable(db: GainframeDb, table: SyncedTableName) {
  return db.table<SyncedRow & Record<string, unknown>, string>(table)
}

const syncedTables = (db: GainframeDb) =>
  syncedTableNameSchema.options.map((table) => syncedTable(db, table))

// The number of rows with changes not yet pushed.
export async function pendingRowCount(db: GainframeDb): Promise<number> {
  const keys = new Set<string>()
  await db.outbox.each((entry) => keys.add(keyOf(entry.table, entry.rowId)))
  return keys.size
}

// The next rows to push, in the order they were first changed, each once with
// its current values. Entries whose row no longer exists are dropped.
export async function readPushBatch(db: GainframeDb, max: number): Promise<PushEntry[]> {
  return db.transaction('rw', [db.outbox, ...syncedTables(db)], async () => {
    const rows = new Map<string, Omit<PushEntry, 'row'>>()
    await db.outbox.orderBy('seq').each((entry) => {
      const key = keyOf(entry.table, entry.rowId)
      const known = rows.get(key)
      if (known !== undefined) known.maxSeq = entry.seq
      else rows.set(key, { table: entry.table, rowId: entry.rowId, maxSeq: entry.seq })
    })
    const batch: PushEntry[] = []
    const missing: Omit<PushEntry, 'row'>[] = []
    for (const entry of rows.values()) {
      if (batch.length === max) break
      const row = await syncedTable(db, entry.table).get(entry.rowId)
      if (row === undefined) missing.push(entry)
      else batch.push({ ...entry, row })
    }
    await removeEntries(db, missing)
    return batch
  })
}

async function removeEntries(db: GainframeDb, settled: Omit<PushEntry, 'row'>[]) {
  if (settled.length === 0) return 0
  const upTo = new Map(settled.map((entry) => [keyOf(entry.table, entry.rowId), entry.maxSeq]))
  return db.outbox
    .filter((entry) => entry.seq <= (upTo.get(keyOf(entry.table, entry.rowId)) ?? -1))
    .delete()
}

// A row the server refused for good: it stays on the device but leaves the
// outbox, and a later edit queues it again.
export interface RejectedRow {
  table: SyncedTableName
  rowId: string
  result: Extract<PushResult, { status: 'rejected' }>
}

// Removes the outbox entries a push settled. A row rejected for clock skew stays
// queued: once the device clock is right, the next push can succeed. Returns the
// rows rejected for good, and how many entries were removed.
export async function settlePush(
  db: GainframeDb,
  batch: PushEntry[],
  results: PushResult[],
): Promise<{ removed: number; rejected: RejectedRow[] }> {
  const settled: PushEntry[] = []
  const rejected: RejectedRow[] = []
  batch.forEach((entry, index) => {
    const result = results[index]
    if (result === undefined) return
    if (result.status === 'rejected') {
      if (result.reason === 'clock_skew') return
      rejected.push({ table: entry.table, rowId: entry.rowId, result })
    }
    settled.push(entry)
  })
  const removed = await db.transaction('rw', db.outbox, () => removeEntries(db, settled))
  return { removed, rejected }
}

const cursorSchema = z.object({ userId: z.string(), cursor: z.int().min(0) })

// The pull cursor of this account. A cursor saved for another account, or none,
// starts from the beginning.
export async function readCursor(db: GainframeDb, userId: string): Promise<number> {
  const setting = await db.settings.get('syncCursor')
  if (setting === undefined) return 0
  try {
    const stored = cursorSchema.safeParse(JSON.parse(setting.value))
    return stored.success && stored.data.userId === userId ? stored.data.cursor : 0
  } catch {
    return 0
  }
}

export interface PulledRow {
  table: SyncedTableName
  row: Record<string, unknown>
}

// Applies one pulled page and stores its cursor in the same transaction. A row
// replaces the local one only when its `updatedAt` is later (the server's rule),
// and creates no outbox entry. Returns the rows that failed their schema, which
// are skipped.
export async function applyPulledPage(
  db: GainframeDb,
  userId: string,
  rows: PulledRow[],
  cursor: number,
): Promise<PulledRow[]> {
  return db.transaction('rw', [db.settings, ...syncedTables(db)], async () => {
    const invalid: PulledRow[] = []
    for (const pulled of rows) {
      const parsed = syncedRowSchemas[pulled.table].safeParse(pulled.row)
      if (!parsed.success) {
        invalid.push(pulled)
        continue
      }
      const table = syncedTable(db, pulled.table)
      const local = await table.get(parsed.data.id)
      if (local === undefined || Date.parse(parsed.data.updatedAt) > Date.parse(local.updatedAt)) {
        await table.put(parsed.data)
      }
    }
    await db.settings.put({ key: 'syncCursor', value: JSON.stringify({ userId, cursor }) })
    return invalid
  })
}

export async function saveLastSync(db: GainframeDb, at: Date): Promise<void> {
  await db.settings.put({ key: 'lastSyncAt', value: at.toISOString() })
}

export async function loadLastSync(db: GainframeDb): Promise<string | null> {
  const setting = await db.settings.get('lastSyncAt')
  return setting?.value ?? null
}
