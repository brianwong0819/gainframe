import {
  exerciseSchema,
  planDaySchema,
  planItemSchema,
  planSchema,
  workoutExerciseSchema,
  workoutSchema,
  workoutSetSchema,
} from '@gainframe/shared'
import { type Column, getTableColumns } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import type { ZodObject } from 'zod'

import { syncedTables } from './schema.ts'

// The row schema each server table mirrors (ADR-0003).
const mirrors = [
  { name: 'exercises', table: syncedTables.exercises, schema: exerciseSchema },
  { name: 'plans', table: syncedTables.plans, schema: planSchema },
  { name: 'planDays', table: syncedTables.planDays, schema: planDaySchema },
  { name: 'planItems', table: syncedTables.planItems, schema: planItemSchema },
  { name: 'workouts', table: syncedTables.workouts, schema: workoutSchema },
  {
    name: 'workoutExercises',
    table: syncedTables.workoutExercises,
    schema: workoutExerciseSchema,
  },
  { name: 'workoutSets', table: syncedTables.workoutSets, schema: workoutSetSchema },
] satisfies { name: keyof typeof syncedTables; table: PgTable; schema: ZodObject }[]

const snakeCase = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

describe('server schema', () => {
  it.each(mirrors)(
    '$name names the same fields as its shared row schema, plus server_version',
    ({ table, schema }) => {
      const columns = Object.keys(getTableColumns(table))
      expect(columns.sort()).toEqual([...Object.keys(schema.shape), 'serverVersion'].sort())
    },
  )

  it.each(mirrors)('$name stores each field in its snake_case column', ({ table }) => {
    const columns: Record<string, Column> = getTableColumns(table)
    for (const [key, column] of Object.entries(columns)) {
      expect(column.name).toBe(snakeCase(key))
    }
  })

  it('checks every synced table', () => {
    expect(mirrors.map(({ name }) => name).sort()).toEqual(Object.keys(syncedTables).sort())
  })
})
