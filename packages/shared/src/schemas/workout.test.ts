import { describe, expect, it } from 'vitest'

import { exerciseSchema } from './exercise.ts'
import { workoutExerciseSchema, workoutSchema, workoutSetSchema } from './workout.ts'

const row = {
  id: '01960000-0000-7000-8000-000000000001',
  userId: null,
  createdAt: '2026-11-08T10:00:00.000Z',
  updatedAt: '2026-11-08T10:00:00.000Z',
  deletedAt: null,
}

const validSet = {
  ...row,
  workoutExerciseId: '01960000-0000-7000-8000-0000000000c1',
  workoutId: '01960000-0000-7000-8000-0000000000a1',
  exerciseId: '01960000-0000-7000-8000-0000000000b1',
  position: 0,
  kind: 'working',
  weightKg: 62.5,
  reps: 8,
  rpe: 8.5,
  completedAt: '2026-11-08T10:05:00.000Z',
}

describe('workoutSetSchema', () => {
  it('accepts a valid set', () => {
    expect(workoutSetSchema.safeParse(validSet).success).toBe(true)
  })

  it('rejects an ID that is not a UUIDv7', () => {
    const uuidV4 = '3b241101-e2bb-4255-8caf-4136c566a962'
    expect(workoutSetSchema.safeParse({ ...validSet, id: uuidV4 }).success).toBe(false)
  })

  it('rejects negative weight, fractional reps and RPE off the half-point scale', () => {
    expect(workoutSetSchema.safeParse({ ...validSet, weightKg: -1 }).success).toBe(false)
    expect(workoutSetSchema.safeParse({ ...validSet, reps: 7.5 }).success).toBe(false)
    expect(workoutSetSchema.safeParse({ ...validSet, rpe: 8.25 }).success).toBe(false)
  })

  it('requires optional fields to be present as null, not omitted', () => {
    const withoutRpe = Object.fromEntries(Object.entries(validSet).filter(([key]) => key !== 'rpe'))
    expect(workoutSetSchema.safeParse(withoutRpe).success).toBe(false)
  })

  it('rejects a timestamp without a UTC offset', () => {
    expect(
      workoutSetSchema.safeParse({ ...validSet, completedAt: '2026-11-08 18:05' }).success,
    ).toBe(false)
  })
})

describe('workoutSchema', () => {
  const validWorkout = {
    ...row,
    startedAt: '2026-11-08T10:00:00.000Z',
    endedAt: '2026-11-08T11:00:00.000Z',
    planDayId: null,
    localDate: '2026-11-08',
    note: null,
  }

  it('accepts a valid workout', () => {
    expect(workoutSchema.safeParse(validWorkout).success).toBe(true)
  })

  it('rejects a workout that ends before it starts', () => {
    const result = workoutSchema.safeParse({ ...validWorkout, endedAt: '2026-11-08T09:00:00.000Z' })
    expect(result.error?.issues[0]?.path).toEqual(['endedAt'])
  })

  it('rejects a local date that is not YYYY-MM-DD', () => {
    expect(workoutSchema.safeParse({ ...validWorkout, localDate: '8/11/2026' }).success).toBe(false)
  })
})

describe('workoutExerciseSchema', () => {
  const validSlot = {
    ...row,
    workoutId: '01960000-0000-7000-8000-0000000000a1',
    exerciseId: '01960000-0000-7000-8000-0000000000b1',
    position: 0,
    supersetGroup: null,
    note: 'Seat at notch 4',
    repsMin: null,
    repsMax: null,
    restS: null,
  }

  it('accepts a valid slot', () => {
    expect(workoutExerciseSchema.safeParse(validSlot).success).toBe(true)
  })

  it('rejects a negative position and a note over 500 characters', () => {
    expect(workoutExerciseSchema.safeParse({ ...validSlot, position: -1 }).success).toBe(false)
    const note = 'x'.repeat(501)
    expect(workoutExerciseSchema.safeParse({ ...validSlot, note }).success).toBe(false)
  })

  it("accepts a plan item's rep range and rest, but not an inverted range", () => {
    const fromPlan = { ...validSlot, repsMin: 8, repsMax: 12, restS: 120 }
    expect(workoutExerciseSchema.safeParse(fromPlan).success).toBe(true)
    const inverted = { ...fromPlan, repsMin: 12, repsMax: 8 }
    expect(workoutExerciseSchema.safeParse(inverted).error?.issues[0]?.path).toEqual(['repsMax'])
  })
})

describe('exerciseSchema', () => {
  const validExercise = {
    ...row,
    nameZh: '上斜哑铃卧推',
    nameEn: null,
    muscle: 'chest',
    secondaryMuscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    defaultRestS: 120,
  }

  it('accepts an exercise named in one language', () => {
    expect(exerciseSchema.safeParse(validExercise).success).toBe(true)
  })

  it('rejects an exercise with no name', () => {
    expect(exerciseSchema.safeParse({ ...validExercise, nameZh: null }).success).toBe(false)
    expect(exerciseSchema.safeParse({ ...validExercise, nameZh: '   ' }).success).toBe(false)
  })

  it('rejects the primary muscle or a repeat among the secondary muscles', () => {
    for (const secondaryMuscles of [['chest'], ['triceps', 'triceps']]) {
      const result = exerciseSchema.safeParse({ ...validExercise, secondaryMuscles })
      expect(result.error?.issues[0]?.path).toEqual(['secondaryMuscles'])
    }
  })
})
