'use client'

import {
  type Exercise,
  setOrder,
  supersetBlocks,
  supersetLabels,
  type Workout,
  type WorkoutSet,
} from '@gainframe/shared'
import { AnimatePresence } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { db, planStore, repositories, weightUnits, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { ActiveWorkoutState } from '@/db/workout-session'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { SupersetBlock } from '@/ui/superset-block'

import { ExerciseDetail } from '../exercises/exercise-detail'
import { exerciseName, findLibraryEntry } from '../exercises/library'
import { findExercise } from './exercise-info'
import { ExercisePicker } from './exercise-picker'
import { allowScreenOff, keepScreenOn, prepareRestCue } from './rest-cue'
import { RestPanel, RestPill, useRest } from './rest-timer'
import { SetDetails } from './set-details'
import { SetPanel } from './set-panel'
import { SetTable } from './set-table'
import { SlotActions } from './slot-actions'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()

type SheetContent =
  | { kind: 'picker' }
  | { kind: 'finish' }
  | { kind: 'set'; setId: string; n: number }
  | { kind: 'actions'; slotId: string }
  | { kind: 'exercise'; exerciseId: string }
  | { kind: 'rest' }

// The set the panel edits: the one the user tapped while it is still there and
// not done, else the first set not done yet in the order they are done in
// (supersets alternate, M1-07).
function selectedSet(state: ActiveWorkoutState, chosenId: string | null) {
  const sets = setOrder(
    state.slots.map(({ slot, sets }) => ({
      slot,
      sets: sets.map((set, index) => ({
        set,
        n: index + 1,
        exerciseId: slot.exerciseId,
        slotId: slot.id,
      })),
    })),
  )
  return (
    sets.find(({ set }) => set.id === chosenId && set.completedAt === null) ??
    sets.find(({ set }) => set.completedAt === null)
  )
}

// The screen stays on while a workout is open (ADR-0005); iOS drops the lock
// whenever the app is hidden, so it is taken again on each return.
function useScreenOn() {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') keepScreenOn()
    }
    keepScreenOn()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      allowScreenOff()
    }
  }, [])
}

export function ActiveWorkout({ state }: { state: ActiveWorkoutState }) {
  const t = useTranslations('workout')
  const locale = useLocale()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const units = useLiveQuery(loadWeightUnits)
  const unitOf = (exerciseId: string) => units?.get(exerciseId) ?? 'kg'
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { workout } = state
  const rest = useRest(workout)
  useScreenOn()
  const selected = selectedSet(state, chosenId)
  const slotRows = state.slots.map(({ slot }) => slot)
  const labels = supersetLabels(slotRows)
  const nameOf = (exerciseId: string) => exerciseName(findExercise(exerciseId, custom), locale)
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

  // Completing a set starts the rest after it (M1-06) and opens the rest
  // sheet; undoing it cancels that rest. The tap also unlocks the cue's audio.
  function toggleDone(set: WorkoutSet) {
    if (set.completedAt !== null) {
      void workoutSession.uncompleteSet(set.id)
      return
    }
    prepareRestCue()
    keepScreenOn()
    void workoutSession.completeSet(set.id).then(({ restEndsAt }) => {
      if (restEndsAt !== null) open({ kind: 'rest' })
    })
  }
  // The rest sheet closes by itself when the rest ends; closed while the rest
  // runs, it collapses to the pill.
  const restSheet = sheet?.kind === 'rest'
  const shown = sheetOpen && !(restSheet && rest === null)

  // The sheet shows the live rows, so a picked chip shows at once.
  const sheetSet =
    sheet?.kind === 'set'
      ? state.slots.flatMap(({ sets }) => sets).find((set) => set.id === sheet.setId)
      : undefined
  const sheetSlot =
    sheet?.kind === 'actions'
      ? state.slots.find(({ slot }) => slot.id === sheet.slotId)?.slot
      : undefined
  const sheetExercise =
    sheet?.kind === 'exercise' ? findLibraryEntry(sheet.exerciseId, custom) : undefined
  const title = {
    exercise: sheetExercise ? exerciseName(sheetExercise, locale) : '',
    picker: t('pickerTitle'),
    finish: t('finishTitle'),
    set: sheet?.kind === 'set' ? `${t('colSet')} ${String(sheet.n)}` : '',
    actions: sheetSlot ? nameOf(sheetSlot.exerciseId) : '',
    rest: t('restTitle'),
  }

  // One exercise's card.
  function slotCard(slotId: string) {
    const slotState = state.slots.find(({ slot }) => slot.id === slotId)
    if (slotState === undefined) return null
    return (
      <SetTable
        key={slotId}
        state={slotState}
        exercise={findExercise(slotState.slot.exerciseId, custom)}
        unit={unitOf(slotState.slot.exerciseId)}
        selectedId={selected?.set.id ?? null}
        onSelect={(set, n) => {
          if (set.completedAt === null) setChosenId(set.id)
          else open({ kind: 'set', setId: set.id, n })
        }}
        onActions={() => {
          open({ kind: 'actions', slotId })
        }}
        onInfo={
          findLibraryEntry(slotState.slot.exerciseId, custom)
            ? () => {
                open({ kind: 'exercise', exerciseId: slotState.slot.exerciseId })
              }
            : null
        }
        supersetLabel={labels.get(slotId) ?? null}
        onToggle={toggleDone}
        onAddSet={() => {
          void workoutSession.addSet(slotId).then((set) => {
            setChosenId(set.id)
          })
        }}
      />
    )
  }

  // The superset's round in progress, "2/3": the first round some member has
  // not finished, out of the most sets any member has.
  function roundOf(slotIds: readonly string[]): string {
    const members = state.slots.filter(({ slot }) => slotIds.includes(slot.id))
    const rounds = Math.max(...members.map(({ sets }) => sets.length))
    const finished = Math.min(
      ...members.map(({ sets }) => {
        const next = sets.findIndex((set) => set.completedAt === null)
        return next === -1 ? sets.length : next
      }),
    )
    return t('supersetRound', { round: Math.min(finished + 1, rounds), rounds })
  }

  return (
    <>
      {state.slots.length === 0 && <p className="text-body text-ink-2">{t('noExercises')}</p>}
      {supersetBlocks(slotRows).map(({ letter, items }) => {
        const cards = items.map((slot) => slotCard(slot.id))
        if (letter === null) return cards
        return (
          <SupersetBlock
            key={letter}
            title={t('supersetTitle', { letter })}
            detail={roundOf(items.map(({ id }) => id))}
          >
            {cards}
          </SupersetBlock>
        )
      })}
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
      <div className="workout-dock flex flex-col gap-8">
        <AnimatePresence>
          {rest && !(shown && restSheet) && (
            <RestPill
              key="rest"
              workout={workout}
              rest={rest}
              onOpen={() => {
                open({ kind: 'rest' })
              }}
            />
          )}
        </AnimatePresence>
        {selected && (
          <SetPanel
            key={selected.set.id}
            set={selected.set}
            n={selected.n}
            exerciseId={selected.exerciseId}
            exercise={findExercise(selected.exerciseId, custom)}
            supersetLabel={labels.get(selected.slotId) ?? null}
            unit={unitOf(selected.exerciseId)}
            onDetails={() => {
              open({ kind: 'set', setId: selected.set.id, n: selected.n })
            }}
            onComplete={() => {
              toggleDone(selected.set)
            }}
          />
        )}
      </div>
      <Sheet
        open={shown}
        onClose={close}
        closeLabel={t('close')}
        title={sheet ? title[sheet.kind] : ''}
      >
        {sheetSet && <SetDetails set={sheetSet} onDeleted={close} />}
        {sheetSlot && (
          <SlotActions
            key={sheetSlot.id}
            slot={sheetSlot}
            slots={slotRows}
            nameOf={nameOf}
            onDone={close}
          />
        )}
        {sheet?.kind === 'picker' && (
          <ExercisePicker
            onPick={({ id }) => {
              setSheetOpen(false)
              void workoutSession.addExercise(workout.id, id)
            }}
          />
        )}
        {sheetExercise && <ExerciseDetail exercise={sheetExercise} />}
        {restSheet && rest && <RestPanel workout={workout} rest={rest} />}
        {sheet?.kind === 'finish' && <FinishConfirm workout={workout} done={done} onDone={close} />}
      </Sheet>
    </>
  )
}

// Finishing keeps the workout; discarding deletes it with its sets, so it asks
// twice.
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
  // Finishing opens the workout's summary; discarding returns to the tab.
  const leave = (write: Promise<unknown>, to: string) => {
    onDone()
    void write.then(() => {
      router.replace(to)
    })
  }
  const summary = `/workout/summary#${workout.id}`
  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">{t('finishBody', { done })}</p>
      <Pressable
        onClick={() => {
          leave(workoutSession.finish(workout.id), summary)
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
              summary,
            )
          }}
          className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
        >
          {t('finishAndSave')}
        </Pressable>
      )}
      <Pressable
        onClick={() => {
          if (discarding) leave(repositories.workouts.remove(workout.id), '/workout')
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
