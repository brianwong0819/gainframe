import { createPlanStore } from './plans'
import { createRepositories } from './repositories'
import { GainframeDb } from './schema'
import { createWeightUnitStore } from './weight-units'
import { createWorkoutSession } from './workout-session'

// The app's one database connection. Dexie opens it on first use, so importing
// this module during the static export build does not touch IndexedDB.
export const db = new GainframeDb()
export const repositories = createRepositories(db)
export const workoutSession = createWorkoutSession(db, repositories)
export const planStore = createPlanStore(db, repositories)
export const weightUnits = createWeightUnitStore(db, repositories)
