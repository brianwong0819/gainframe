import { Dexie, type DexieOptions, type EntityTable, type Table } from 'dexie'

import type { Exercise, Template, TemplateItem, Workout, WorkoutSet } from '@gainframe/shared'

// Tables whose rows sync to the server (ADR-0003). Built-in exercises are a
// constant in @gainframe/shared, not rows.
export type SyncedTableName =
  'exercises' | 'templates' | 'templateItems' | 'workouts' | 'workoutSets'

// One pending change. The sync engine (M2-05) reads entries in `seq` order and
// pushes each row's current values, so an entry names the row, not the change.
export interface OutboxEntry {
  seq: number
  table: SyncedTableName
  rowId: string
}

// The device database. Only src/db touches it; the UI goes through the
// repositories. Every version after 1 needs an upgrade test (docs/conventions.md).
export class GainframeDb extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<Template, string>
  templateItems!: Table<TemplateItem, string>
  workouts!: Table<Workout, string>
  workoutSets!: Table<WorkoutSet, string>
  outbox!: EntityTable<OutboxEntry, 'seq'>

  constructor(name = 'gainframe', options?: DexieOptions) {
    super(name, options)
    // Only fields that queries filter or sort on are indexed; Dexie stores the rest.
    this.version(1).stores({
      exercises: 'id',
      templates: 'id',
      templateItems: 'id, templateId',
      workouts: 'id, startedAt',
      workoutSets: 'id, workoutId, exerciseId',
      outbox: '++seq',
    })
  }
}
