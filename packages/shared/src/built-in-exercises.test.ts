import { describe, expect, it } from 'vitest'

import { BUILT_IN_EXERCISES } from './built-in-exercises.ts'
import { builtInExerciseSchema } from './schemas/exercise.ts'

describe('BUILT_IN_EXERCISES', () => {
  it('matches the built-in exercise schema', () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      expect(builtInExerciseSchema.safeParse(exercise).error).toBeUndefined()
    }
  })

  it('numbers its IDs 1 to n with no gaps or repeats', () => {
    const numbers = BUILT_IN_EXERCISES.map((exercise) => Number(exercise.id.slice(-12)))
    expect(numbers).toEqual(BUILT_IN_EXERCISES.map((_, index) => index + 1))
  })

  it('has unique Chinese and English names', () => {
    const zh = new Set(BUILT_IN_EXERCISES.map((exercise) => exercise.nameZh))
    const en = new Set(BUILT_IN_EXERCISES.map((exercise) => exercise.nameEn.toLowerCase()))
    expect(zh.size).toBe(BUILT_IN_EXERCISES.length)
    expect(en.size).toBe(BUILT_IN_EXERCISES.length)
  })

  it('never repeats a search term: no name or alias belongs to two exercises', () => {
    const owners = new Map<string, string>()
    for (const exercise of BUILT_IN_EXERCISES) {
      const terms = [exercise.nameZh, exercise.nameEn, ...exercise.aliases].map((term) =>
        term
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[\p{P}\p{Z}\s]/gu, ''),
      )
      for (const term of new Set(terms)) {
        expect(owners.get(term), term).toBeUndefined()
        owners.set(term, exercise.id)
      }
    }
  })

  it('rests compound exercises at least as long as isolation exercises', () => {
    const rests = (mechanic: string) =>
      BUILT_IN_EXERCISES.filter((exercise) => exercise.mechanic === mechanic).map(
        (exercise) => exercise.defaultRestS,
      )
    expect(Math.min(...rests('compound'))).toBeGreaterThanOrEqual(Math.max(...rests('isolation')))
  })
})
