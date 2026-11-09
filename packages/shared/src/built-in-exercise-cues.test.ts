import { describe, expect, it } from 'vitest'

import { BUILT_IN_EXERCISE_CUES, builtInExerciseCues } from './built-in-exercise-cues.ts'
import { BUILT_IN_EXERCISES } from './built-in-exercises.ts'
import { exerciseCuesSchema } from './schemas/exercise.ts'

describe('BUILT_IN_EXERCISE_CUES', () => {
  it('has one entry per built-in exercise', () => {
    expect(BUILT_IN_EXERCISE_CUES).toHaveLength(BUILT_IN_EXERCISES.length)
  })

  it('gives every exercise two or three cues in both languages', () => {
    for (const cues of BUILT_IN_EXERCISE_CUES) {
      expect(exerciseCuesSchema.safeParse(cues).error).toBeUndefined()
    }
  })

  it('finds the cues of an exercise by its ID', () => {
    const bench = BUILT_IN_EXERCISES[0]
    expect(bench?.nameEn).toBe('Barbell bench press')
    expect(builtInExerciseCues(bench?.id ?? '')?.en[0]).toContain('shoulder blades')
    expect(builtInExerciseCues('019a6000-0000-7000-8000-000000000001')).toBeUndefined()
  })
})
