'use client'

import type { Exercise } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, repositories, weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { WorkoutSummaryState } from '@/db/workout-summary'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { SwipeRow } from '@/ui/swipe-row'

import { exerciseName } from '../exercises/library'
import { findExercise } from '../workout/exercise-info'
import { SetDetails } from '../workout/set-details'
import { SetFields } from '../workout/set-fields'
import { WorkoutSummaryView } from '../workout/workout-summary'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()

interface Editing {
  setId: string
  n: number
}

// A finished workout from history: its summary with every set listed. A tap
// on a set opens it in a sheet (weight, reps, kind, RPE, delete); a swipe to
// the left deletes it. Figures and records follow every change, because the
// summary is a live query. Deleting the workout asks for a second tap.
export function PastWorkout({ state }: { state: WorkoutSummaryState }) {
  const t = useTranslations('history')
  const tWorkout = useTranslations('workout')
  const tKind = useTranslations('setKindShort')
  const locale = useLocale()
  const router = useRouter()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const units = useLiveQuery(loadWeightUnits)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sets = state.summary.exercises.flatMap((exercise) => exercise.sets)
  // The sheet keeps its last set while it slides away; a deleted set closes it.
  const editedSet = sets.find(({ id }) => id === editing?.setId)
  const shown = sheetOpen && editedSet !== undefined
  const close = () => {
    setSheetOpen(false)
  }

  return (
    <>
      <WorkoutSummaryView
        state={state}
        setList={({ sets: done }, setText) => (
          <ol className="flex flex-col gap-4">
            {done.map((set, index) => (
              <li key={set.id}>
                <SwipeRow
                  open={swipedId === set.id}
                  onOpenChange={(open) => {
                    setSwipedId(open ? set.id : null)
                  }}
                  actionLabel={t('swipeDelete')}
                  onAction={() => {
                    setSwipedId(null)
                    void repositories.workoutSets.remove(set.id)
                  }}
                >
                  <SetRow
                    n={index + 1}
                    text={setText(set)}
                    kind={set.kind === 'working' ? null : tKind(set.kind)}
                    label={t('editSet', { n: index + 1, set: setText(set) })}
                    onEdit={() => {
                      setSwipedId(null)
                      setEditing({ setId: set.id, n: index + 1 })
                      setSheetOpen(true)
                    }}
                  />
                </SwipeRow>
              </li>
            ))}
          </ol>
        )}
      />
      <Pressable
        onClick={() => {
          if (!deleting) {
            setDeleting(true)
            return
          }
          void repositories.workouts.remove(state.workout.id).then(() => {
            router.push('/workout/history')
          })
        }}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
      >
        {deleting
          ? t('deleteWorkoutConfirm', { sets: state.summary.setsDone })
          : t('deleteWorkout')}
      </Pressable>
      <Sheet
        open={shown}
        onClose={close}
        closeLabel={tWorkout('close')}
        title={
          editedSet && editing
            ? t('setTitle', {
                n: editing.n,
                name: exerciseName(findExercise(editedSet.exerciseId, custom), locale),
              })
            : ''
        }
      >
        {editedSet && editing && (
          <div className="flex flex-col gap-20">
            <SetFields
              set={editedSet}
              n={editing.n}
              exerciseId={editedSet.exerciseId}
              exercise={findExercise(editedSet.exerciseId, custom)}
              unit={units?.get(editedSet.exerciseId) ?? 'kg'}
            />
            <SetDetails set={editedSet} onDeleted={close} />
          </div>
        )}
      </Sheet>
    </>
  )
}

function SetRow({
  n,
  text,
  kind,
  label,
  onEdit,
}: {
  n: number
  text: string
  kind: string | null
  label: string
  onEdit: () => void
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={label}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-12 rounded-ctl bg-sunk px-12 py-12 text-left"
    >
      <span className="num text-label text-ink-3">{n}</span>
      <span className="num text-body text-ink">{text}</span>
      <span className="text-label text-ink-3">{kind}</span>
    </button>
  )
}
