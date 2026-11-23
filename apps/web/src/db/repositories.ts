import type { Table } from 'dexie'
import type { z } from 'zod'

import {
  bodyMetricSchema,
  exerciseSchema,
  foodSchema,
  mealItemSchema,
  mealSchema,
  planDaySchema,
  planItemSchema,
  planSchema,
  profileSchema,
  type SyncedTableName,
  workoutExerciseSchema,
  workoutSchema,
  workoutSetSchema,
} from '@gainframe/shared'

import { newId } from './id'
import type { GainframeDb } from './schema'

interface SyncedRow {
  id: string
  userId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// The fields a caller provides; the repository sets the shared row fields.
export type NewRow<T> = Omit<T, keyof SyncedRow>

interface Context {
  db: GainframeDb
  now: () => Date
}

// Last writer wins on `updatedAt` and an equal value is ignored (ADR-0003), so a
// change must always move it forward, even when the device clock has gone back.
export function nextUpdatedAt(previous: string, now: Date): string {
  const previousMs = Date.parse(previous)
  return new Date(Math.max(now.getTime(), previousMs + 1)).toISOString()
}

// Soft-deletes the rows of one child table that belong to a deleted parent.
interface Cascade {
  table: Table
  run: (parentId: string) => Promise<void>
}

function cascade<C extends SyncedRow>(
  { db, now }: Context,
  name: SyncedTableName,
  table: Table<C, string>,
  foreignKey: keyof C & string,
): Cascade {
  return {
    table,
    run: async (parentId) => {
      const children = await table
        .where(foreignKey)
        .equals(parentId)
        .filter((child) => child.deletedAt === null)
        .toArray()
      for (const child of children) {
        const at = nextUpdatedAt(child.updatedAt, now())
        await table.put({ ...child, deletedAt: at, updatedAt: at })
        await db.outbox.add({ table: name, rowId: child.id })
      }
    },
  }
}

// Every write validates the row and adds its outbox entry in the same Dexie
// transaction, so a crash or a failed validation leaves neither.
function repository<T extends SyncedRow>(
  { db, now }: Context,
  name: SyncedTableName,
  table: Table<T, string>,
  schema: z.ZodType<T>,
  cascades: Cascade[] = [],
) {
  return {
    // A soft-deleted row reads as missing.
    async get(id: string): Promise<T | undefined> {
      const row = await table.get(id)
      return row?.deletedAt === null ? row : undefined
    },

    async create(values: NewRow<T>): Promise<T> {
      const at = now()
      const iso = at.toISOString()
      const row = schema.parse({
        ...values,
        id: newId(at.getTime()),
        userId: null,
        createdAt: iso,
        updatedAt: iso,
        deletedAt: null,
      })
      await db.transaction('rw', table, db.outbox, async () => {
        await table.add(row)
        await db.outbox.add({ table: name, rowId: row.id })
      })
      return row
    },

    async update(id: string, changes: Partial<NewRow<T>>): Promise<T> {
      return db.transaction('rw', table, db.outbox, async () => {
        const current = await table.get(id)
        if (current?.deletedAt !== null) throw new Error(`No ${name} row ${id}`)
        const row = schema.parse({
          ...current,
          ...changes,
          updatedAt: nextUpdatedAt(current.updatedAt, now()),
        })
        await table.put(row)
        await db.outbox.add({ table: name, rowId: id })
        return row
      })
    },

    // Deleting is an ordinary update of `deletedAt`; children go in the same
    // transaction. Deleting a missing or deleted row does nothing.
    async remove(id: string): Promise<void> {
      const tables = [table, db.outbox, ...cascades.map((child) => child.table)]
      await db.transaction('rw', tables, async () => {
        const current = await table.get(id)
        if (current?.deletedAt !== null) return
        const at = nextUpdatedAt(current.updatedAt, now())
        await table.put({ ...current, deletedAt: at, updatedAt: at })
        await db.outbox.add({ table: name, rowId: id })
        for (const child of cascades) await child.run(id)
      })
    },
  }
}

export function createRepositories(db: GainframeDb, now: () => Date = () => new Date()) {
  const context = { db, now }
  return {
    exercises: repository(context, 'exercises', db.exercises, exerciseSchema),
    // Items carry `planId` too, so deleting a plan reaches them directly.
    plans: repository(context, 'plans', db.plans, planSchema, [
      cascade(context, 'planDays', db.planDays, 'planId'),
      cascade(context, 'planItems', db.planItems, 'planId'),
    ]),
    planDays: repository(context, 'planDays', db.planDays, planDaySchema, [
      cascade(context, 'planItems', db.planItems, 'planDayId'),
    ]),
    planItems: repository(context, 'planItems', db.planItems, planItemSchema),
    // Sets carry `workoutId` too, so deleting a workout reaches them directly.
    workouts: repository(context, 'workouts', db.workouts, workoutSchema, [
      cascade(context, 'workoutExercises', db.workoutExercises, 'workoutId'),
      cascade(context, 'workoutSets', db.workoutSets, 'workoutId'),
    ]),
    workoutExercises: repository(
      context,
      'workoutExercises',
      db.workoutExercises,
      workoutExerciseSchema,
      [cascade(context, 'workoutSets', db.workoutSets, 'workoutExerciseId')],
    ),
    workoutSets: repository(context, 'workoutSets', db.workoutSets, workoutSetSchema),
    meals: repository(context, 'meals', db.meals, mealSchema, [
      cascade(context, 'mealItems', db.mealItems, 'mealId'),
    ]),
    mealItems: repository(context, 'mealItems', db.mealItems, mealItemSchema),
    profiles: repository(context, 'profiles', db.profiles, profileSchema),
    bodyMetrics: repository(context, 'bodyMetrics', db.bodyMetrics, bodyMetricSchema),
    foods: repository(context, 'foods', db.foods, foodSchema),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
