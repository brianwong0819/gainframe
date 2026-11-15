import type { ExerciseSummary, MuscleGroup } from '@gainframe/shared'

export interface ExerciseLine {
  exerciseId: string
  sets: number
}

// A workout's exercises for its history card: one line per exercise with the
// sets done across all its slots, in the order first done; exercises with no
// completed set are left out.
export function exerciseLines(exercises: readonly ExerciseSummary[]): ExerciseLine[] {
  const lines = new Map<string, ExerciseLine>()
  for (const { slot, setsDone } of exercises) {
    if (setsDone === 0) continue
    const line = lines.get(slot.exerciseId)
    if (line === undefined)
      lines.set(slot.exerciseId, { exerciseId: slot.exerciseId, sets: setsDone })
    else line.sets += setsDone
  }
  return [...lines.values()]
}

// The muscle groups a workout trained most, by completed sets of the
// exercises whose primary muscle they are, at most `count`.
export function mainMuscles(
  lines: readonly ExerciseLine[],
  muscleOf: (exerciseId: string) => MuscleGroup | null,
  count: number,
): MuscleGroup[] {
  const sets = new Map<MuscleGroup, number>()
  for (const { exerciseId, sets: done } of lines) {
    const muscle = muscleOf(exerciseId)
    if (muscle !== null) sets.set(muscle, (sets.get(muscle) ?? 0) + done)
  }
  return [...sets.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([muscle]) => muscle)
}
