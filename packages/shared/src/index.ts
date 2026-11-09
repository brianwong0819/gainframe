// Public entry of @gainframe/shared: Zod schemas, inferred types and pure domain
// functions used by both apps.
export { type ApiError, apiErrorSchema } from './api-error.ts'
export {
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERROR_STACK_MAX,
  type ClientError,
  clientErrorSchema,
  type ClientErrorSource,
  clientErrorSourceSchema,
} from './schemas/client-error.ts'
export { builtInExerciseCues } from './built-in-exercise-cues.ts'
export { BUILT_IN_EXERCISES } from './built-in-exercises.ts'
export { domainConfig } from './config.ts'
export { searchExercises } from './domain/exercise-search.ts'
export { toLocalDate } from './domain/local-date.ts'
export {
  nextPlanDay,
  planItemsFromWorkout,
  type PlanItemValues,
  suggestRestS,
} from './domain/plan.ts'
export {
  bestWeightKg,
  estimateOneRepMax,
  findPersonalRecords,
  nextSetValues,
  previousPerformance,
  type SetValues,
  totalVolumeKg,
} from './domain/workout.ts'
export {
  type BuiltInExercise,
  builtInExerciseSchema,
  type Equipment,
  equipmentSchema,
  type Exercise,
  type ExerciseCues,
  exerciseCuesSchema,
  exerciseSchema,
  type Mechanic,
  mechanicSchema,
  type MuscleGroup,
  muscleGroupSchema,
} from './schemas/exercise.ts'
export { instantSchema, type LocalDate, localDateSchema, syncedRowSchema } from './schemas/row.ts'
export {
  type Plan,
  type PlanDay,
  planDaySchema,
  type PlanItem,
  planItemSchema,
  planSchema,
} from './schemas/plan.ts'
export {
  type SetKind,
  setKindSchema,
  type Workout,
  type WorkoutExercise,
  workoutExerciseSchema,
  workoutSchema,
  type WorkoutSet,
  workoutSetSchema,
} from './schemas/workout.ts'
