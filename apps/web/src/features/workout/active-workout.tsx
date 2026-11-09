'use client'

import type { Exercise, Workout, WorkoutSet } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { db, repositories, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { ActiveWorkoutState } from '@/db/workout-session'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { findExercise } from './exercise-info'
import { ExercisePicker } from './exercise-picker'
import { SetPanel } from './set-panel'
import { SetTable } from './set-table'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

type SheetKind = 'picker' | 'finish'

// The set the panel edits: the one the user tapped while it is still there and
// not done, else the first set not done yet.
function selectedSet(state: ActiveWorkoutState, chosenId: string | null) {
  const sets = state.slots.flatMap(({ slot, sets }) =>
    sets.map((set, index) => ({ set, n: index + 1, exerciseId: slot.exerciseId })),
  )
  return (
    sets.find(({ set }) => set.id === chosenId && set.completedAt === null) ??
    sets.find(({ set }) => set.completedAt === null)
  )
}

function setDone(set: WorkoutSet, done: boolean) {
  void repositories.workoutSets.update(set.id, {
    completedAt: done ? new Date().toISOString() : null,
  })
}

export function ActiveWorkout({ state }: { state: ActiveWorkoutState }) {
  const t = useTranslations('workout')
  const custom = useLiveQuery(allCustomExercises) ?? []
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { workout } = state
  const selected = selectedSet(state, chosenId)
  const done = state.slots.reduce(
    (count, { sets }) => count + sets.filter((set) => set.completedAt !== null).length,
    0,
  )

  function open(kind: SheetKind) {
    setSheet(kind)
    setSheetOpen(true)
  }

  return (
    <>
      {state.slots.length === 0 && <p className="text-body text-ink-2">{t('noExercises')}</p>}
      {state.slots.map((slotState) => (
        <SetTable
          key={slotState.slot.id}
          state={slotState}
          exercise={findExercise(slotState.slot.exerciseId, custom)}
          selectedId={selected?.set.id ?? null}
          onSelect={(set) => {
            setChosenId(set.id)
          }}
          onToggle={(set) => {
            setDone(set, set.completedAt === null)
          }}
          onAddSet={() => {
            void workoutSession.addSet(slotState.slot.id).then((set) => {
              setChosenId(set.id)
            })
          }}
        />
      ))}
      <div className="flex gap-8">
        <Pressable
          onClick={() => {
            open('picker')
          }}
          className="flex-1 rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('addExercise')}
        </Pressable>
        <Pressable
          onClick={() => {
            open('finish')
          }}
          className="flex-1 rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('finish')}
        </Pressable>
      </div>
      {selected && (
        <SetPanel
          key={selected.set.id}
          set={selected.set}
          n={selected.n}
          exercise={findExercise(selected.exerciseId, custom)}
          onComplete={() => {
            setDone(selected.set, true)
          }}
        />
      )}
      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        closeLabel={t('close')}
        title={sheet === 'finish' ? t('finishTitle') : t('pickerTitle')}
      >
        {sheet === 'picker' && (
          <ExercisePicker
            onPick={(exerciseId) => {
              setSheetOpen(false)
              void workoutSession.addExercise(workout.id, exerciseId)
            }}
          />
        )}
        {sheet === 'finish' && (
          <FinishConfirm
            workout={workout}
            done={done}
            onDone={() => {
              setSheetOpen(false)
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function FinishConfirm({
  workout,
  done,
  onDone,
}: {
  workout: Workout
  done: number
  onDone: () => void
}) {
  const t = useTranslations('workout')
  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">{t('finishBody', { done })}</p>
      <Pressable
        onClick={() => {
          onDone()
          void workoutSession.finish(workout.id)
        }}
        className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg"
      >
        {t('finishConfirm')}
      </Pressable>
    </div>
  )
}

const loadActive = () => workoutSession.loadActive()

// The workout in progress; null when there is none, undefined while loading.
export function useActiveWorkout(): ActiveWorkoutState | null | undefined {
  return useLiveQuery(loadActive)
}
