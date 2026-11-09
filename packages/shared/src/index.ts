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
export { domainConfig } from './config.ts'
export { toLocalDate } from './domain/local-date.ts'
export {
  estimateOneRepMax,
  findPersonalRecords,
  previousPerformance,
  totalVolumeKg,
} from './domain/workout.ts'
export {
  type Equipment,
  equipmentSchema,
  type Exercise,
  exerciseSchema,
  type MuscleGroup,
  muscleGroupSchema,
} from './schemas/exercise.ts'
export { instantSchema, type LocalDate, localDateSchema, syncedRowSchema } from './schemas/row.ts'
export {
  type Template,
  type TemplateItem,
  templateItemSchema,
  templateSchema,
} from './schemas/template.ts'
export {
  type SetKind,
  setKindSchema,
  type Workout,
  workoutSchema,
  type WorkoutSet,
  workoutSetSchema,
} from './schemas/workout.ts'
