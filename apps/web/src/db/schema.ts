import { Dexie, type DexieOptions, type EntityTable, type Table, type Transaction } from 'dexie'

import {
  type BodyMetric,
  type ClientError,
  type Exercise,
  type ExerciseUnit,
  type Food,
  type FoodEstimateRequest,
  type FoodEstimateResponse,
  type LocalDate,
  type Meal,
  type MealItem,
  type MealType,
  type PhotoIssue,
  type Plan,
  type PlanDay,
  type PlanItem,
  type Profile,
  sharedValueChanges,
  type SyncedTableName,
  type Workout,
  weightUnitSchema,
  type WorkoutExercise,
  type WorkoutSet,
} from '@gainframe/shared'

import { parseSession } from './auth-session'
import { restResolver } from './exercise-rest'
import { newId } from './id'
import { nextUpdatedAt } from './repositories'

// One pending change to a synced table (ADR-0003; Dexie uses the table names
// of the sync protocol). The sync engine (M2-05) reads entries in `seq` order and
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

// A setting that belongs to this device and never syncs, so it is lost when
// the device is emptied and downloads the account again (L-051).
// `authSession` is the signed-in session as
// JSON (db/auth-session.ts, ADR-0007). `syncCursor` is the pull cursor and the
// account it belongs to, `lastSyncAt` the end of the last successful backup
// (db/sync.ts). `signInCardDismissed` hides Today's sign-in card for good.
// `errorsReportedSeq` is the last error log entry sent to the API
// (diagnostics/error-reports.ts).
export type DeviceSetting =
  | { key: 'authSession'; value: string }
  | { key: 'syncCursor'; value: string }
  | { key: 'lastSyncAt'; value: string }
  | { key: 'signInCardDismissed'; value: string }
  | { key: 'errorsReportedSeq'; value: string }

// A meal photo taken while offline (M3-03), kept on this device only and never
// synced or exported: the photo is personal and only the estimate needs it. It
// is estimated when the app is next online and backed up (food/photo-queue.ts);
// the user then confirms it, which logs the meal at `takenAt` and deletes the
// row. `estimate` is the result once there is one; `stoppedBy` is why the
// estimate stopped when retrying would not help: the model could not count the
// photo or refused it, or the account has no AI features.
export interface PendingPhoto {
  id: string
  takenAt: string
  localDate: LocalDate
  mealType: MealType
  photo: FoodEstimateRequest['photo']
  estimate: FoodEstimateResponse | null
  stoppedBy: PhotoIssue | 'refused' | 'notEnabled' | null
}

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
  meals!: Table<Meal, string>
  mealItems!: Table<MealItem, string>
  profiles!: Table<Profile, string>
  bodyMetrics!: Table<BodyMetric, string>
  foods!: Table<Food, string>
  exerciseUnits!: Table<ExerciseUnit, string>
  pendingPhotos!: Table<PendingPhoto, string>
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
    // M1-06: a workout keeps its running rest; existing workouts have none. No
    // outbox entry, as in version 3.
    this.version(8)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Record<string, unknown>, string>('workouts')
          .toCollection()
          .modify((workout) => {
            workout.restStartedAt ??= null
            workout.restEndsAt ??= null
          }),
      )
    // A superset has one rest and, in a plan, one number of rounds.
    this.version(9).stores({}).upgrade(shareSupersetValues)
    // M3-01: meals, read by day, and their items, read by meal.
    this.version(10).stores({ meals: 'id, localDate', mealItems: 'id, mealId' })
    // M3-02: the daily targets.
    this.version(11).stores({ profiles: 'id' })
    // M4-01: the profile's body fields, empty until the calculator is used, and
    // the body metrics, read by day. The server's new columns are null as well,
    // so the change needs no sync.
    this.version(12)
      .stores({ bodyMetrics: 'id, localDate' })
      .upgrade((tx) =>
        tx
          .table<Profile>('profiles')
          .toCollection()
          .modify((profile) => {
            profile.sex ??= null
            profile.birthYear ??= null
            profile.heightCm ??= null
            profile.activityLevel ??= null
            profile.phase ??= null
          }),
      )
    // M2-06: a row's `userId` is set once the account holds it.
    this.version(13).stores({}).upgrade(adoptBackedUpRows)
    // M3-12: the user's foods and edits of food table entries, found by entry.
    this.version(14).stores({ foods: 'id, tableId' })
    // M3-03: photos taken offline that wait for their estimate, read by day.
    this.version(15).stores({ pendingPhotos: 'id, localDate' })
    // The active plan moves from the device setting `activePlanId` to the
    // plan's synced `activatedAt`, so it survives a cleared device.
    this.version(16).stores({}).upgrade(moveActivePlanToPlans)
    // The per-exercise weight unit moves from device settings to synced rows.
    this.version(17).stores({ exerciseUnits: 'id, exerciseId' }).upgrade(moveWeightUnitsToRows)
  }
}

// Version 17. Each `weightUnit:<exerciseId>` setting becomes an `exerciseUnits`
// row with an outbox entry, so the next backup carries the choice to the account.
// Only pounds was stored; kg was the absence of a setting.
export async function moveWeightUnitsToRows(tx: Transaction): Promise<void> {
  const prefix = 'weightUnit:'
  const settings = tx.table<{ key: string; value: string }, string>('settings')
  const at = new Date()
  for (const { key, value } of await settings.where('key').startsWith(prefix).toArray()) {
    const unit = weightUnitSchema.safeParse(value)
    const exerciseId = key.slice(prefix.length)
    if (unit.success && unit.data === 'lb') {
      const row: ExerciseUnit = {
        id: newId(at.getTime()),
        userId: null,
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        deletedAt: null,
        exerciseId,
        weightUnit: unit.data,
      }
      await tx.table('exerciseUnits').add(row)
      await tx.table('outbox').add({ table: 'exerciseUnits', rowId: row.id })
    }
    await settings.delete(key)
  }
}

// Version 16. Every plan gains `activatedAt`, null except on the plan the
// removed setting named, which is changed like any edit: a later `updatedAt`
// and an outbox entry, so the next backup carries the choice to the account.
export async function moveActivePlanToPlans(tx: Transaction): Promise<void> {
  const settings = tx.table<{ key: string; value: string }, string>('settings')
  const plans = tx.table<StoredRow, string>('plans')
  const activeId = (await settings.get('activePlanId'))?.value
  await plans.toCollection().modify((plan) => {
    plan.activatedAt ??= null
  })
  const active = activeId === undefined ? undefined : await plans.get(activeId)
  if (active?.deletedAt === null) {
    const at = new Date()
    await plans.update(active.id, {
      activatedAt: at.toISOString(),
      updatedAt: nextUpdatedAt(text(active, 'updatedAt'), at),
    })
    await tx.table('outbox').add({ table: 'plans', rowId: active.id })
  }
  await settings.delete('activePlanId')
}

// Version 13. A push now sets `userId` on each row the account accepted
// (db/sync.ts). Rows a signed-in device pushed before that kept null: on such a
// device, every row with no change waiting is in the account. A row the server
// refused for good also has none and is labelled too; it stays on the device as
// before. A signed-out device has nothing to adopt.
// The upgrade names the synced tables of version 13 itself: a table added in a
// later version is not part of this step's transaction.
const V13_SYNCED_TABLES = [
  'exercises',
  'plans',
  'planDays',
  'planItems',
  'workouts',
  'workoutExercises',
  'workoutSets',
  'meals',
  'mealItems',
  'profiles',
  'bodyMetrics',
] as const satisfies readonly SyncedTableName[]

export async function adoptBackedUpRows(tx: Transaction): Promise<void> {
  const session = parseSession(await tx.table<DeviceSetting, string>('settings').get('authSession'))
  if (session === null) return
  const waiting = new Set(
    (await tx.table<OutboxEntry, number>('outbox').toArray()).map(
      (entry) => `${entry.table} ${entry.rowId}`,
    ),
  )
  for (const table of V13_SYNCED_TABLES) {
    await tx
      .table<{ id: string; userId: string | null }, string>(table)
      .filter((row) => row.userId === null && !waiting.has(`${table} ${row.id}`))
      .modify({ userId: session.userId })
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

// Version 8 lets the members of a superset differ; the workout took the last
// member's rest. Version 9 gives every member of each superset the longest
// rest of its members, and in a plan the most sets, which a workout already
// did in rounds. Changed rows get outbox entries, since sync must push them.
export async function shareSupersetValues(tx: Transaction): Promise<void> {
  const now = new Date()
  const restOf = await restResolver(tx.table<Exercise, string>('exercises'))
  const live = (row: { deletedAt: string | null }) => row.deletedAt === null
  const restOfRow = (row: { restS: number | null }) => row.restS

  const items = await tx.table<PlanItem, string>('planItems').filter(live).toArray()
  for (const day of Map.groupBy(items, (item) => item.planDayId).values()) {
    const changes = new Map<string, Partial<PlanItem>>()
    for (const { id, value } of sharedValueChanges(day, restOf, restOfRow)) {
      changes.set(id, { restS: value })
    }
    const sets = (item: PlanItem) => item.targetSets
    for (const { id, value } of sharedValueChanges(day, sets, sets)) {
      changes.set(id, { ...changes.get(id), targetSets: value })
    }
    for (const item of day) {
      const change = changes.get(item.id)
      if (change === undefined) continue
      await tx.table('planItems').update(item.id, {
        ...change,
        updatedAt: nextUpdatedAt(item.updatedAt, now),
      })
      await tx.table('outbox').add({ table: 'planItems', rowId: item.id })
    }
  }

  const slots = await tx.table<WorkoutExercise, string>('workoutExercises').filter(live).toArray()
  for (const workout of Map.groupBy(slots, (slot) => slot.workoutId).values()) {
    for (const { id, value } of sharedValueChanges(workout, restOf, restOfRow)) {
      const slot = workout.find((other) => other.id === id)
      if (slot === undefined) continue
      await tx.table('workoutExercises').update(id, {
        restS: value,
        updatedAt: nextUpdatedAt(slot.updatedAt, now),
      })
      await tx.table('outbox').add({ table: 'workoutExercises', rowId: id })
    }
  }
}
