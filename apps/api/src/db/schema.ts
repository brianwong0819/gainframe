// The server's copy of the synced tables (ADR-0003). Each table mirrors a row
// schema in @gainframe/shared column for column, plus `server_version`, which
// only the server writes; schema.test.ts checks that both name the same fields.
// Values are validated with those Zod schemas at the API boundary, so columns
// hold plain types (enums as text) and an added enum value needs no migration.
// No foreign keys: rows arrive in batches and may reference a parent from a
// later batch. Every query is scoped by `user_id`, the Cognito `sub`.
import {
  type AnyPgColumn,
  bigint,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core'

// An instant is a `timestamptz` read and written as the client's ISO string
// (`2026-11-08T14:40:26.000Z`), so rows go between the Zod schemas and the
// database unchanged. The driver hands Drizzle the Postgres text form, which
// `Date` parses.
const instant = customType<{ data: string; driverData: string }>({
  dataType: () => 'timestamp with time zone',
  fromDriver: (value) => new Date(value).toISOString(),
})

const syncedColumns = {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: instant('created_at').notNull(),
  updatedAt: instant('updated_at').notNull(),
  deletedAt: instant('deleted_at'),
  // The user's sync counter when the row was last applied; pulls page by it.
  serverVersion: bigint('server_version', { mode: 'number' }).notNull(),
}

// Pull reads `server_version > cursor` for one user, in order.
const pullIndex =
  (table: string) => (columns: { userId: AnyPgColumn; serverVersion: AnyPgColumn }) => [
    index(`${table}_user_version_idx`).on(columns.userId, columns.serverVersion),
  ]

export const exercises = pgTable(
  'exercises',
  {
    ...syncedColumns,
    nameZh: text('name_zh'),
    nameEn: text('name_en'),
    muscle: text('muscle').notNull(),
    secondaryMuscles: text('secondary_muscles').array().notNull(),
    equipment: text('equipment').notNull(),
    defaultRestS: integer('default_rest_s').notNull(),
  },
  pullIndex('exercises'),
)

export const plans = pgTable(
  'plans',
  {
    ...syncedColumns,
    name: text('name').notNull(),
    activatedAt: instant('activated_at'),
  },
  pullIndex('plans'),
)

export const planDays = pgTable(
  'plan_days',
  {
    ...syncedColumns,
    planId: uuid('plan_id').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
  },
  pullIndex('plan_days'),
)

export const planItems = pgTable(
  'plan_items',
  {
    ...syncedColumns,
    planId: uuid('plan_id').notNull(),
    planDayId: uuid('plan_day_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    position: integer('position').notNull(),
    supersetGroup: integer('superset_group'),
    targetSets: integer('target_sets').notNull(),
    repsMin: integer('reps_min').notNull(),
    repsMax: integer('reps_max').notNull(),
    restS: integer('rest_s'),
    note: text('note'),
  },
  pullIndex('plan_items'),
)

export const workouts = pgTable(
  'workouts',
  {
    ...syncedColumns,
    startedAt: instant('started_at').notNull(),
    endedAt: instant('ended_at'),
    planDayId: uuid('plan_day_id'),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    note: text('note'),
    restStartedAt: instant('rest_started_at'),
    restEndsAt: instant('rest_ends_at'),
  },
  pullIndex('workouts'),
)

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    ...syncedColumns,
    workoutId: uuid('workout_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    position: integer('position').notNull(),
    supersetGroup: integer('superset_group'),
    note: text('note'),
    repsMin: integer('reps_min'),
    repsMax: integer('reps_max'),
    restS: integer('rest_s'),
    planNote: text('plan_note'),
  },
  pullIndex('workout_exercises'),
)

export const workoutSets = pgTable(
  'workout_sets',
  {
    ...syncedColumns,
    workoutExerciseId: uuid('workout_exercise_id').notNull(),
    workoutId: uuid('workout_id').notNull(),
    exerciseId: uuid('exercise_id').notNull(),
    position: integer('position').notNull(),
    kind: text('kind').notNull(),
    weightKg: doublePrecision('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    rpe: doublePrecision('rpe'),
    completedAt: instant('completed_at'),
  },
  pullIndex('workout_sets'),
)

export const meals = pgTable(
  'meals',
  {
    ...syncedColumns,
    eatenAt: instant('eaten_at').notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    mealType: text('meal_type').notNull(),
    name: text('name'),
    photoKey: text('photo_key'),
  },
  pullIndex('meals'),
)

export const mealItems = pgTable(
  'meal_items',
  {
    ...syncedColumns,
    mealId: uuid('meal_id').notNull(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    grams: doublePrecision('grams').notNull(),
    proteinG: doublePrecision('protein_g').notNull(),
    kcal: doublePrecision('kcal').notNull(),
    source: text('source').notNull(),
    aiRaw: jsonb('ai_raw'),
  },
  pullIndex('meal_items'),
)

export const profiles = pgTable(
  'profiles',
  {
    ...syncedColumns,
    proteinMode: text('protein_mode').notNull(),
    proteinValue: doublePrecision('protein_value').notNull(),
    kcalTarget: integer('kcal_target').notNull(),
    sex: text('sex'),
    birthYear: integer('birth_year'),
    heightCm: doublePrecision('height_cm'),
    activityLevel: text('activity_level'),
    phase: text('phase'),
  },
  pullIndex('profiles'),
)

export const bodyMetrics = pgTable(
  'body_metrics',
  {
    ...syncedColumns,
    measuredAt: instant('measured_at').notNull(),
    localDate: date('local_date', { mode: 'string' }).notNull(),
    weightKg: doublePrecision('weight_kg').notNull(),
    bodyFatPct: doublePrecision('body_fat_pct'),
    skeletalMuscleKg: doublePrecision('skeletal_muscle_kg'),
    fatMassKg: doublePrecision('fat_mass_kg'),
    source: text('source').notNull(),
  },
  pullIndex('body_metrics'),
)

export const foods = pgTable(
  'foods',
  {
    ...syncedColumns,
    tableId: text('table_id'),
    name: text('name').notNull(),
    proteinPer100G: doublePrecision('protein_per100_g').notNull(),
    kcalPer100G: doublePrecision('kcal_per100_g').notNull(),
    servings: jsonb('servings').notNull(),
  },
  pullIndex('foods'),
)

// One row per user: the last `server_version` handed out. A push locks this
// row (`UPDATE ... RETURNING`), which serializes one user's pushes (ADR-0003).
export const syncState = pgTable('sync_state', {
  userId: text('user_id').primaryKey(),
  serverVersion: bigint('server_version', { mode: 'number' }).notNull().default(0),
})

// Server-only, never synced: one row per user, day and AI feature, counting
// the calls made and their tokens. A call is counted before it is made, so the
// daily cap holds even when calls fail (apps/api/src/ai/usage.ts). `day` is
// the UTC date: a date sent by the client could be changed to reset the cap.
export const aiUsage = pgTable(
  'ai_usage',
  {
    userId: text('user_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    feature: text('feature').notNull(),
    calls: integer('calls').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day, table.feature] })],
)

// Accounts deleted with DELETE /api/account (M2-10): only the opaque Cognito
// `sub`, never personal data. An access token stays valid for up to an hour
// after its user is deleted, so a push checks this table and refuses the
// user instead of recreating rows for an account that no longer exists.
export const deletedUsers = pgTable('deleted_users', {
  userId: text('user_id').primaryKey(),
  deletedAt: instant('deleted_at').notNull(),
})

// The synced tables, keyed by the client's table names (`SyncedTableName` in
// the web app's Dexie schema).
export const syncedTables = {
  exercises,
  plans,
  planDays,
  planItems,
  workouts,
  workoutExercises,
  workoutSets,
  meals,
  mealItems,
  profiles,
  bodyMetrics,
  foods,
}
