import type { ExerciseSummary, MuscleGroup } from '@gainframe/shared'
import { describe, expect, it } from 'vitest'

import { exerciseLines, mainMuscles } from './card-lines'

function exercise(exerciseId: string, setsDone: number): ExerciseSummary {
  const slot = {
    id: `slot-${exerciseId}`,
    userId: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    deletedAt: null,
    workoutId: 'workout',
    exerciseId,
    position: 0,
    supersetGroup: null,
    note: null,
    repsMin: null,
    repsMax: null,
    restS: null,
    planNote: null,
  }
  return { slot, sets: [], setsDone, volumeKg: 0, topSet: null, records: [] }
}

describe('history card lines', () => {
  it('merges slots of the same exercise and leaves out exercises with no sets', () => {
    const lines = exerciseLines([
      exercise('bench', 3),
      exercise('fly', 3),
      exercise('bench', 4),
      exercise('dip', 0),
    ])
    expect(lines).toEqual([
      { exerciseId: 'bench', sets: 7 },
      { exerciseId: 'fly', sets: 3 },
    ])
  })

  it('ranks muscles by sets and skips unknown exercises', () => {
    const muscles = new Map<string, MuscleGroup>([
      ['bench', 'chest'],
      ['fly', 'chest'],
      ['curl', 'biceps'],
      ['row', 'back'],
    ])
    const lines = [
      { exerciseId: 'bench', sets: 3 },
      { exerciseId: 'row', sets: 4 },
      { exerciseId: 'fly', sets: 2 },
      { exerciseId: 'curl', sets: 1 },
      { exerciseId: 'missing', sets: 9 },
    ]
    expect(mainMuscles(lines, (id) => muscles.get(id) ?? null, 2)).toEqual(['chest', 'back'])
  })
})
