import { Dexie, type DexieOptions, type EntityTable, type Table, type Transaction } from 'dexie'

import type {
  ClientError,
  Exercise,
  Plan,
  PlanDay,
  PlanItem,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@gainframe/shared'

import { newId } from './id'
import { nextUpdatedAt } from './repositories'

// Tables whose rows sync to the server (ADR-0003). Built-in exercises are a
// constant in @gainframe/shared, not rows.
export type SyncedTableName =
  'exercises' | 'plans' | 'planDays' | 'planItems' | 'workouts' | 'workoutExercises' | 'workoutSets'

// One pending change. The sync engine (M2-05) reads entries in `seq` order and
// pushes each row's current values, so an entry names the row, not the change.
export interface OutboxEntry {
  seq: number
  table: SyncedTableName
  rowId: string
}

// A recorded client error (src/diagnostics). Not synced; capped on the device.
export interface ErrorLogEntry extends ClientError {
  seq: number
}

// A setting that belongs to this device and never syncs. `activePlanId` names
// the plan the Workout tab offers; keeping it here rather than as a flag on plan
// rows means two devices can never both mark a plan active.
// `weightUnit:<exerciseId>` is the unit that exercise is shown and typed in when
// it is not kg (db/weight-units.ts).
export type DeviceSetting =
  { key: 'activePlanId'; value: string } | { key: `weightUnit:${string}`; value: string }

// Version 1 (M1-02), kept as written: Dexie upgrades an existing database from
// it, and db/upgrade.test.ts opens it to build the old database.
export const STORES_V1 = {
  exercises: 'id',
  templates: 'id',
  templateItems: 'id, templateId',
  workouts: 'id, startedAt',
  workoutSets: 'id, workoutId, exerciseId',
  outbox: '++seq',
}

// The device database. Only src/db touches it; the UI goes through the
// repositories. Every version after 1 needs an upgrade test (docs/conventions.md).
export class GainframeDb extends Dexie {
  exercises!: Table<Exercise, string>
  plans!: Table<Plan, string>
  planDays!: Table<PlanDay, string>
  planItems!: Table<PlanItem, string>
  workouts!: Table<Workout, string>
  workoutExercises!: Table<WorkoutExercise, string>
  workoutSets!: Table<WorkoutSet, string>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  errors!: EntityTable<ErrorLogEntry, 'seq'>
  settings!: EntityTable<DeviceSetting, 'key'>

  constructor(name = 'gainframe', options?: DexieOptions) {
    super(name, options)
    // Only fields that queries filter or sort on are indexed; Dexie stores the rest.
    this.version(1).stores(STORES_V1)
    // M1-03: the client error log.
    this.version(2).stores({ errors: '++seq' })
    // M1-04: custom exercises gain secondary muscles; older ones have none. No
    // outbox entry: rows have not synced yet, and the sync engine (M2-05) pushes
    // each row whole.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Record<string, unknown>, string>('exercises')
          .toCollection()
          .modify((exercise) => {
            exercise.secondaryMuscles ??= []
          }),
      )
    // M1-05: exercise slots. Each set moves into a slot and its superset group
    // moves to the slot.
    this.version(4)
      .stores({
        workoutExercises: 'id, workoutId, exerciseId',
        workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
      })
      .upgrade(moveSetsIntoSlots)
    // M1-09: plans replace templates. The app never wrote templates, so their
    // tables go; a workout's `templateId` becomes `planDayId`. No outbox entry,
    // as in version 3.
    this.version(5)
      .stores({
        templates: null,
        templateItems: null,
        plans: 'id',
        planDays: 'id, planId',
        planItems: 'id, planId, planDayId',
        workouts: 'id, startedAt, planDayId',
        settings: 'key',
      })
      .upgrade((tx) =>
        tx
          .table<Record<string, unknown>, string>('workouts')
          .toCollection()
          .modify((workout) => {
            workout.planDayId = workout.templateId ?? null
            delete workout.templateId
          }),
      )
    // M1-09: a slot started from a plan copies the item's rep range and rest;
    // existing slots were added by hand and have none. No outbox entry, as in
    // version 3.
    this.version(6)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Record<string, unknown>, string>('workoutExercises')
          .toCollection()
          .modify((slot) => {
            slot.repsMin ??= null
            slot.repsMax ??= null
            slot.restS ??= null
          }),
      )
    // Plan items gain the plan's note, and slots a copy of it; older rows have
    // none. No outbox entry, as in version 3.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table<Record<string, unknown>, string>('planItems')
          .toCollection()
          .modify((item) => {
            item.note ??= null
          })
        await tx
          .table<Record<string, unknown>, string>('workoutExercises')
          .toCollection()
          .modify((slot) => {
            slot.planNote ??= null
          })
      })
  }
}

type StoredRow = Record<string, unknown> & { id: string }

function text(row: StoredRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Row ${row.id} has no ${key}`)
  return value
}

// Version 3 sets point at their workout and exercise only. One slot is created
// per (workout, exercise) pair, ordered by the pair's first set; a slot whose
// sets are all deleted is deleted too. New slots and changed sets get outbox
// entries, since the sync engine (M2-05) must push them.
export async function moveSetsIntoSlots(tx: Transaction): Promise<void> {
  const nowMs = Date.now()
  const at = new Date(nowMs).toISOString()
  const setTable = tx.table<StoredRow, string>('workoutSets')
  const sets = (await setTable.toArray()).toSorted(
    (a, b) => Number(a.position) - Number(b.position),
  )
  const groups = new Map<string, StoredRow[]>()
  for (const set of sets) {
    const key = `${text(set, 'workoutId')} ${text(set, 'exerciseId')}`
    groups.set(key, [...(groups.get(key) ?? []), set])
  }
  const nextPosition = new Map<string, number>()
  for (const group of groups.values()) {
    const [first] = group
    if (first === undefined) continue
    const workoutId = text(first, 'workoutId')
    const position = nextPosition.get(workoutId) ?? 0
    nextPosition.set(workoutId, position + 1)
    const live = group.some((set) => set.deletedAt === null)
    const slot: Omit<WorkoutExercise, 'repsMin' | 'repsMax' | 'restS' | 'planNote'> = {
      id: newId(nowMs),
      userId: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: live ? null : at,
      workoutId,
      exerciseId: text(first, 'exerciseId'),
      position,
      supersetGroup: typeof first.supersetGroup === 'number' ? first.supersetGroup : null,
      note: null,
    }
    await tx.table('workoutExercises').add(slot)
    await tx.table('outbox').add({ table: 'workoutExercises', rowId: slot.id })
    for (const set of group) {
      const moved: StoredRow = {
        ...set,
        workoutExerciseId: slot.id,
        updatedAt: nextUpdatedAt(text(set, 'updatedAt'), new Date(nowMs)),
      }
      delete moved.supersetGroup
      await setTable.put(moved)
      await tx.table('outbox').add({ table: 'workoutSets', rowId: set.id })
    }
  }
}
