// Public entry of @gainframe/shared: Zod schemas, inferred types and pure domain
// functions used by both apps.
export { AI_GROUP, groupsAllowAi } from './ai-access.ts'
export { type ApiError, apiErrorSchema } from './api-error.ts'
export {
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERROR_REPORT_BYTES_MAX,
  CLIENT_ERROR_REPORT_MAX,
  CLIENT_ERROR_STACK_MAX,
  type ClientError,
  type ClientErrorReport,
  clientErrorReportResponseSchema,
  clientErrorReportSchema,
  clientErrorSchema,
  type ClientErrorSource,
  clientErrorSourceSchema,
} from './schemas/client-error.ts'
export { builtInExerciseCues } from './built-in-exercise-cues.ts'
export { BUILT_IN_EXERCISES } from './built-in-exercises.ts'
export { domainConfig, syncConfig } from './config.ts'
export {
  oilSauceKcal,
  portionGrams,
  type PortionSize,
  resolveEstimate,
  spreadKcal,
  visionReplyIssues,
  withFoodEdits,
} from './domain/food-estimate.ts'
export { searchByName } from './domain/name-search.ts'
export {
  addDays,
  fillProteinGap,
  mealTypeAt,
  nutritionTotals,
  type NutritionTotals,
  type PastFood,
  pastFoods,
  scalePortion,
} from './domain/nutrition.ts'
export {
  currentFoods,
  foodLibrary,
  type FoodOrigin,
  type LibraryFood,
  per100G,
  type Portion,
  portionOf,
  withLibraryPortions,
} from './domain/food-library.ts'
export { TOKEN_HEADER, tokenFromHeader, tokenHeaderValue } from './token-header.ts'
export { toLocalDate } from './domain/local-date.ts'
export {
  type EstimateInput,
  estimateTargets,
  type TargetEstimate,
} from './domain/target-estimate.ts'
export { nextPlanDay, planItemsFromWorkout, type PlanItemValues } from './domain/plan.ts'
export {
  adjustRestEnd,
  type RestState,
  restSeconds,
  restState,
  type RestTimes,
} from './domain/rest.ts'
export {
  earlierRoundToDo,
  type GroupChange,
  type GroupedItem,
  linkedWithNext,
  linkWithNext,
  moveItem,
  type PositionChange,
  restSlotAfter,
  type RoundSet,
  setOrder,
  sharedValueChanges,
  type SupersetBlock,
  supersetBlocks,
  supersetLabels,
  supersetMembers,
  supersetValue,
  unlinkFromNext,
  type ValueChange,
} from './domain/superset.ts'
export {
  estimateDurationS,
  lastOfPlanDay,
  summarizeWeek,
  totalWorkouts,
  type WeekSummary,
  weekDates,
} from './domain/week.ts'
export { displayWeight, fromKg, stepToGrid, toKg } from './domain/weight-unit.ts'
export {
  bestWeightKg,
  estimateOneRepMax,
  findPersonalRecords,
  type LoadRules,
  nextSetValues,
  previousPerformance,
  type RecordKind,
  setsFollowingWeight,
  setsTakingWeight,
  type SetValues,
  totalVolumeKg,
} from './domain/workout.ts'
export {
  bestSets,
  compareSummaries,
  type ExerciseSummary,
  type RecentRecord,
  recentRecords,
  type SummaryComparison,
  summarizeHistory,
  summarizeWorkout,
  type WorkoutSummary,
  type WorkoutSummaryEntry,
} from './domain/workout-summary.ts'
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
export {
  type Food,
  foodSchema,
  type FoodServing,
  foodServingSchema,
  type Meal,
  type MealItem,
  mealItemSchema,
  type MealItemSource,
  mealItemSourceSchema,
  mealSchema,
  type MealType,
  mealTypeSchema,
} from './schemas/food.ts'
export {
  type EstimateAiRaw,
  type OilSauce,
  type PhotoIssue,
  TEXT_MEAL_CHARS_MAX,
  type TextAnswer,
  type TextEstimateRequest,
  textEstimateRequestSchema,
  type TextEstimateResponse,
  textEstimateResponseSchema,
  type TextMealReply,
  textMealReplySchema,
  type TextQuestion,
  photoIssueSchema,
  oilSauceSchema,
  estimateAiRawSchema,
  FOOD_ESTIMATE_BODY_BYTES_MAX,
  FOOD_ESTIMATES_PER_DAY,
  FOOD_PHOTO_LONG_EDGE_PX,
  type FoodEstimateItem,
  type FoodEstimateRequest,
  foodEstimateRequestSchema,
  type FoodEstimateResponse,
  foodEstimateResponseSchema,
  type VisionItem,
  type VisionReply,
  visionReplySchema,
} from './schemas/food-estimate.ts'
export {
  type FoodTableEntry,
  foodTableEntrySchema,
  type FoodTableSource,
  foodTableSourceSchema,
} from './schemas/food-table.ts'
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
  type ActivityLevel,
  activityLevelSchema,
  type Phase,
  phaseSchema,
  type Profile,
  profileSchema,
  type ProteinMode,
  proteinModeSchema,
  type Sex,
  sexSchema,
} from './schemas/profile.ts'
export { type BodyMetric, bodyMetricSchema, bodyMetricSourceSchema } from './schemas/body-metric.ts'
export {
  type SetKind,
  setKindSchema,
  type Workout,
  type WorkoutExercise,
  workoutExerciseSchema,
  workoutSchema,
  type WorkoutSet,
  workoutSetSchema,
  type WeightUnit,
  weightUnitSchema,
} from './schemas/workout.ts'
export {
  type PullResponse,
  pullResponseSchema,
  type PushRejection,
  pushRejectionSchema,
  type PushRequest,
  pushRequestSchema,
  type PushResponse,
  pushResponseSchema,
  type PushResult,
  pushResultSchema,
  SYNC_VERSION,
  SYNC_VERSION_HEADER,
  type SyncedTableName,
  syncedRowSchemas,
  syncedTableNameSchema,
} from './schemas/sync.ts'
