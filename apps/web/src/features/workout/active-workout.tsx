'use client'

import type { Exercise, Workout, WorkoutSet } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, planStore, repositories, weightUnits, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { ActiveWorkoutState } from '@/db/workout-session'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { findExercise } from './exercise-info'
import { ExercisePicker } from './exercise-picker'
import { SetDetails } from './set-details'
import { SetPanel } from './set-panel'
import { SetTable } from './set-table'
import { SlotNote } from './slot-note'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()

type SheetContent =
  | { kind: 'picker' }
  | { kind: 'finish' }
  | { kind: 'set'; setId: string; n: number }
  | { kind: 'note'; slotId: string }

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

function toggleDone(set: WorkoutSet) {
  void repositories.workoutSets.update(set.id, {
    completedAt: set.completedAt === null ? new Date().toISOString() : null,
  })
}

export function ActiveWorkout({ state }: { state: ActiveWorkoutState }) {
  const t = useTranslations('workout')
  const custom = useLiveQuery(allCustomExercises) ?? []
  const units = useLiveQuery(loadWeightUnits)
  const unitOf = (exerciseId: string) => units?.get(exerciseId) ?? 'kg'
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { workout } = state
  const selected = selectedSet(state, chosenId)
  const done = state.slots.reduce(
    (count, { sets }) => count + sets.filter((set) => set.completedAt !== null).length,
    0,
  )

  function open(content: SheetContent) {
    setSheet(content)
    setSheetOpen(true)
  }
  const close = () => {
    setSheetOpen(false)
  }

  // The sheet shows the live rows, so a picked chip shows at once.
  const sheetSet =
    sheet?.kind === 'set'
      ? state.slots.flatMap(({ sets }) => sets).find((set) => set.id === sheet.setId)
      : undefined
  const sheetSlot =
    sheet?.kind === 'note'
      ? state.slots.find(({ slot }) => slot.id === sheet.slotId)?.slot
      : undefined
  const title = {
    picker: t('pickerTitle'),
    finish: t('finishTitle'),
    set: sheet?.kind === 'set' ? `${t('colSet')} ${String(sheet.n)}` : '',
    note: t('note'),
  }

  return (
    <>
      {state.slots.length === 0 && <p className="text-body text-ink-2">{t('noExercises')}</p>}
      {state.slots.map((slotState) => (
        <SetTable
          key={slotState.slot.id}
          state={slotState}
          exercise={findExercise(slotState.slot.exerciseId, custom)}
          unit={unitOf(slotState.slot.exerciseId)}
          selectedId={selected?.set.id ?? null}
          onSelect={(set, n) => {
            if (set.completedAt === null) setChosenId(set.id)
            else open({ kind: 'set', setId: set.id, n })
          }}
          onNote={() => {
            open({ kind: 'note', slotId: slotState.slot.id })
          }}
          onToggle={toggleDone}
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
            open({ kind: 'picker' })
          }}
          className="flex-1 rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('addExercise')}
        </Pressable>
        <Pressable
          onClick={() => {
            open({ kind: 'finish' })
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
          exerciseId={selected.exerciseId}
          exercise={findExercise(selected.exerciseId, custom)}
          unit={unitOf(selected.exerciseId)}
          onDetails={() => {
            open({ kind: 'set', setId: selected.set.id, n: selected.n })
          }}
        />
      )}
      <Sheet
        open={sheetOpen}
        onClose={close}
        closeLabel={t('close')}
        title={sheet ? title[sheet.kind] : ''}
      >
        {sheetSet && <SetDetails set={sheetSet} onDeleted={close} />}
        {sheetSlot && <SlotNote key={sheetSlot.id} slot={sheetSlot} onDone={close} />}
        {sheet?.kind === 'picker' && (
          <ExercisePicker
            onPick={(exerciseId) => {
              setSheetOpen(false)
              void workoutSession.addExercise(workout.id, exerciseId)
            }}
          />
        )}
        {sheet?.kind === 'finish' && <FinishConfirm workout={workout} done={done} onDone={close} />}
      </Sheet>
    </>
  )
}

// Finishing keeps the workout; discarding deletes it with its sets, so it asks
// twice. Either way the screen returns to the Workout tab.
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
  const tPlans = useTranslations('plans')
  const router = useRouter()
  const [discarding, setDiscarding] = useState(false)
  const leave = (write: Promise<unknown>) => {
    onDone()
    void write.then(() => {
      router.replace('/workout')
    })
  }
  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">{t('finishBody', { done })}</p>
      <Pressable
        onClick={() => {
          leave(workoutSession.finish(workout.id))
        }}
        className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg"
      >
        {t('finishConfirm')}
      </Pressable>
      {workout.planDayId === null && done > 0 && (
        <Pressable
          onClick={() => {
            leave(
              workoutSession.finish(workout.id).then(() =>
                planStore.saveWorkoutAsDay(workout.id, {
                  plan: tPlans('newName'),
                  day: (n) => tPlans('dayName', { n }),
                }),
              ),
            )
          }}
          className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
        >
          {t('finishAndSave')}
        </Pressable>
      )}
      <Pressable
        onClick={() => {
          if (discarding) leave(repositories.workouts.remove(workout.id))
          else setDiscarding(true)
        }}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
      >
        {discarding ? t('discardConfirm', { done }) : t('discard')}
      </Pressable>
    </div>
  )
}

const loadActive = () => workoutSession.loadActive()

// The workout in progress; null when there is none, undefined while loading.
export function useActiveWorkout(): ActiveWorkoutState | null | undefined {
  return useLiveQuery(loadActive)
}
