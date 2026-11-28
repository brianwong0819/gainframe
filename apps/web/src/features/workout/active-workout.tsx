'use client'

import {
  earlierRoundToDo,
  estimateDurationS,
  type Exercise,
  findPersonalRecords,
  setOrder,
  supersetBlocks,
  supersetLabels,
  supersetValue,
  totalVolumeKg,
  type Workout,
  type WorkoutSet,
} from '@gainframe/shared'
import { AnimatePresence } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { db, planStore, repositories, weightUnits, workoutSession } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import type { ActiveWorkoutState } from '@/db/workout-session'
import { loadRules } from '@/db/workout-summary'
import { celebrationsOff, celebrationTiming, chalk, plates, recordBadge } from '@/ui/celebration'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { SupersetBlock } from '@/ui/superset-block'

import { ExerciseDetail } from '../exercises/exercise-detail'
import { exerciseName, findLibraryEntry, formatRest } from '../exercises/library'
import { itemRestS } from '../plans/estimate'
import { formatRepRange } from '../plans/item-edit'
import { findExercise } from './exercise-info'
import { ExercisePicker } from './exercise-picker'
import { markJustFinished } from './just-finished'
import { allowScreenOff, keepScreenOn, prepareRestCue, watchRestCue } from './rest-cue'
import { RestPanel, RestPill, useRest } from './rest-timer'
import { SessionHeader } from './session-header'
import { SetDetails } from './set-details'
import { SetFields } from './set-fields'
import { SetPanel } from './set-panel'
import { SetTable } from './set-table'
import { SlotActions } from './slot-actions'
import { SupersetRestSheet } from './superset-rest-sheet'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()
const loadWeightUnits = () => weightUnits.all()
const noExercises: Exercise[] = []

type SheetContent =
  | { kind: 'picker' }
  | { kind: 'finish' }
  | { kind: 'set'; setId: string; n: number }
  | { kind: 'actions'; slotId: string }
  | { kind: 'exercise'; exerciseId: string }
  | { kind: 'rest' }
  // A superset's rest, found through one of its members.
  | { kind: 'superset'; slotId: string }
  // A check tapped on a set of a later round than the one in progress.
  | {
      kind: 'ahead'
      setId: string
      anchor: Element
      round: number
      next: number
      superset: boolean
    }

// The set the panel edits: the one the user tapped while it is still there and
// not done, else the first set not done yet in the order they are done in
// (supersets alternate, M1-07).
export function selectedSet(state: ActiveWorkoutState, chosenId: string | null) {
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

// The plan's rep range for a slot ("12–15"); null for a slot without one.
function slotRepRange({ repsMin, repsMax }: { repsMin: number | null; repsMax: number | null }) {
  return repsMin === null || repsMax === null ? null : formatRepRange({ repsMin, repsMax })
}

export function ActiveWorkout({ state }: { state: ActiveWorkoutState }) {
  const t = useTranslations('workout')
  const locale = useLocale()
  const custom = useLiveQuery(allCustomExercises) ?? noExercises
  const units = useLiveQuery(loadWeightUnits)
  const unitOf = (exerciseId: string) => units?.get(exerciseId) ?? 'kg'
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { workout } = state
  const rest = useRest(workout)
  useScreenOn()
  useEffect(watchRestCue, [])
  const selected = selectedSet(state, chosenId)
  const rangeOf = (slotId: string) => {
    const slot = state.slots.find((slotState) => slotState.slot.id === slotId)?.slot
    return slot ? slotRepRange(slot) : null
  }
  const slotRows = state.slots.map(({ slot }) => slot)
  const labels = supersetLabels(slotRows)
  const nameOf = (exerciseId: string) => exerciseName(findExercise(exerciseId, custom), locale)
  const total = state.slots.reduce((count, { sets }) => count + sets.length, 0)
  // The records of this workout so far, and whether completing `set` now
  // would set one.
  const rules = useMemo(() => loadRules(custom), [custom])
  const { isBodyweight } = rules
  const earlier = useMemo(
    () => [
      ...new Map(
        state.slots.flatMap(({ earlier }) => earlier).map((set) => [set.id, set]),
      ).values(),
    ],
    [state.slots],
  )
  const doneSets = state.slots.flatMap(({ sets }) => sets.filter((set) => set.completedAt !== null))
  const done = doneSets.length
  const remainingS = estimateDurationS(
    state.slots.map(({ slot, sets }) => ({
      sets: sets.filter((set) => set.completedAt === null).length,
      restS: itemRestS(slot, custom),
    })),
  )
  const recordIds = new Set(findPersonalRecords(doneSets, earlier, isBodyweight).keys())
  const wouldBeRecord = (set: WorkoutSet) =>
    findPersonalRecords(
      [...doneSets, { ...set, completedAt: new Date().toISOString() }],
      earlier,
      isBodyweight,
    ).has(set.id)

  function open(content: SheetContent) {
    setSheet(content)
    setSheetOpen(true)
  }
  const close = () => {
    setSheetOpen(false)
  }

  // Completing a set starts the rest after it (M1-06) and celebrates it at
  // the tapped button: chalk always, plates and the "New PR" tag for a record,
  // smaller plates for an exercise's last set. The rest sheet opens once the
  // celebration has played, so it does not cover it; the rest itself counts
  // from the tap. Undoing a set cancels its rest. The tap also unlocks the
  // cue's audio.
  function toggleDone(set: WorkoutSet, anchor: Element) {
    if (set.completedAt !== null) {
      void workoutSession.uncompleteSet(set.id)
      return
    }
    prepareRestCue()
    keepScreenOn()
    const record = wouldBeRecord(set)
    const slotSets = state.slots.find(({ sets }) => sets.some(({ id }) => id === set.id))?.sets
    const lastOfExercise =
      slotSets?.every((other) => other.id === set.id || other.completedAt !== null) ?? false
    chalk(anchor)
    if (record) {
      plates(anchor)
      recordBadge(anchor, t('newRecord'))
    } else if (lastOfExercise) {
      plates(anchor, 14, 0.85)
    }
    const waitS = celebrationsOff()
      ? 0
      : record
        ? celebrationTiming.recordS
        : celebrationTiming.chalkS
    void workoutSession.completeSet(set.id).then(({ restEndsAt }) => {
      if (restEndsAt === null) return
      setTimeout(() => {
        open({ kind: 'rest' })
      }, waitS * 1000)
    })
  }
  // A check on a set of a later round than the one in progress is most likely
  // a mis-tap that would also end the running rest, so it asks first; the set
  // the panel shows was chosen on purpose and never asks.
  function tapCheck(set: WorkoutSet, anchor: Element) {
    const round =
      set.completedAt !== null || set.id === selected?.set.id
        ? null
        : earlierRoundToDo(
            slotRows,
            state.slots.flatMap(({ sets }) => sets),
            set.workoutExerciseId,
            set.position,
          )
    if (round === null) {
      toggleDone(set, anchor)
      return
    }
    const sets = state.slots.find(({ slot }) => slot.id === set.workoutExerciseId)?.sets ?? []
    open({
      kind: 'ahead',
      setId: set.id,
      anchor,
      round,
      next: sets.findIndex(({ id }) => id === set.id) + 1,
      superset: labels.has(set.workoutExerciseId),
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
  const sheetSuperset =
    sheet?.kind === 'superset'
      ? supersetBlocks(slotRows).find(
          ({ letter, items }) => letter !== null && items.some(({ id }) => id === sheet.slotId),
        )
      : undefined
  const sheetExercise =
    sheet?.kind === 'exercise' ? findLibraryEntry(sheet.exerciseId, custom) : undefined
  const title = {
    exercise: sheetExercise ? exerciseName(sheetExercise, locale) : '',
    picker: t('pickerTitle'),
    finish: t('finishTitle'),
    set:
      sheet?.kind === 'set'
        ? sheetSet !== undefined && sheetSet.completedAt !== null
          ? `${nameOf(sheetSet.exerciseId)} · ${t('colSet')} ${String(sheet.n)}`
          : `${t('colSet')} ${String(sheet.n)}`
        : '',
    actions: sheetSlot ? nameOf(sheetSlot.exerciseId) : '',
    rest: t('restTitle'),
    superset: t('supersetSheetTitle', { letter: sheetSuperset?.letter ?? '' }),
    ahead: t('aheadTitle'),
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
        recordIds={recordIds}
        onToggle={tapCheck}
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
      <SessionHeader
        workout={workout}
        done={done}
        total={total}
        remainingS={remainingS}
        onFinish={() => {
          open({ kind: 'finish' })
        }}
      />
      {state.slots.length === 0 && <p className="text-body text-ink-2">{t('noExercises')}</p>}
      {supersetBlocks(slotRows).map(({ letter, items }) => {
        const cards = items.map((slot) => slotCard(slot.id))
        if (letter === null) return cards
        return (
          <SupersetBlock
            key={letter}
            title={t('supersetTitle', { letter })}
            detail={t('supersetDetail', {
              round: roundOf(items.map(({ id }) => id)),
              time: formatRest(supersetValue(items, (slot) => itemRestS(slot, custom))),
            })}
            onEdit={() => {
              if (items[0]) open({ kind: 'superset', slotId: items[0].id })
            }}
          >
            {cards}
          </SupersetBlock>
        )
      })}
      <Pressable
        onClick={() => {
          open({ kind: 'picker' })
        }}
        className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
      >
        {t('addExercise')}
      </Pressable>
      <div className="screen-dock flex flex-col gap-8">
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
            of={
              state.slots.find(({ slot }) => slot.id === selected.slotId)?.sets.length ?? selected.n
            }
            exerciseId={selected.exerciseId}
            exercise={findExercise(selected.exerciseId, custom)}
            supersetLabel={labels.get(selected.slotId) ?? null}
            unit={unitOf(selected.exerciseId)}
            repRange={rangeOf(selected.slotId)}
            onDetails={() => {
              open({ kind: 'set', setId: selected.set.id, n: selected.n })
            }}
            onComplete={(anchor) => {
              toggleDone(selected.set, anchor)
            }}
          />
        )}
        {!selected && done > 0 && (
          <DonePanel
            done={done}
            volumeKg={totalVolumeKg(doneSets, rules)}
            records={recordIds.size}
            onFinish={() => {
              open({ kind: 'finish' })
            }}
          />
        )}
      </div>
      <Sheet
        open={shown}
        onClose={close}
        closeLabel={t('close')}
        title={sheet ? title[sheet.kind] : ''}
        fullHeight={sheet?.kind === 'picker'}
      >
        {sheetSet && sheet?.kind === 'set' && (
          <div className="flex flex-col gap-20">
            {/* A done set is corrected here; a set still to do has the panel. */}
            {sheetSet.completedAt !== null && (
              <SetFields
                set={sheetSet}
                n={sheet.n}
                exerciseId={sheetSet.exerciseId}
                exercise={findExercise(sheetSet.exerciseId, custom)}
                unit={unitOf(sheetSet.exerciseId)}
                repRange={rangeOf(sheetSet.workoutExerciseId)}
              />
            )}
            <SetDetails set={sheetSet} onDeleted={close} />
          </div>
        )}
        {sheetSlot && (
          <SlotActions
            key={sheetSlot.id}
            slot={sheetSlot}
            slots={slotRows}
            nameOf={nameOf}
            onDone={close}
            onLinked={() => {
              setSheet({ kind: 'superset', slotId: sheetSlot.id })
            }}
          />
        )}
        {sheetSuperset && (
          <SupersetRestSheet
            members={sheetSuperset.items}
            names={sheetSuperset.items.map(({ exerciseId }) => nameOf(exerciseId))}
            custom={custom}
          />
        )}
        {sheet?.kind === 'picker' && (
          <ExercisePicker
            onPick={({ id }) => {
              setSheetOpen(false)
              void workoutSession.addExercise(workout.id, id)
            }}
            onCreated={({ id }) => {
              setSheetOpen(false)
              void workoutSession.addExercise(workout.id, id)
            }}
          />
        )}
        {sheetExercise && <ExerciseDetail exercise={sheetExercise} />}
        {restSheet && rest && (
          <RestPanel
            workout={workout}
            rest={rest}
            next={
              selected
                ? {
                    set: selected.set,
                    name: nameOf(selected.exerciseId),
                    n: selected.n,
                    of:
                      state.slots.find(({ slot }) => slot.id === selected.slotId)?.sets.length ??
                      selected.n,
                    unit: unitOf(selected.exerciseId),
                    bodyweight: isBodyweight(selected.exerciseId),
                  }
                : null
            }
          />
        )}
        {sheet?.kind === 'ahead' && (
          <AheadConfirm
            body={
              sheet.superset
                ? t('aheadRound', { round: sheet.round, next: sheet.next })
                : t('aheadSet', { n: sheet.round })
            }
            resting={rest !== null}
            onConfirm={() => {
              close()
              const live = state.slots
                .flatMap(({ sets }) => sets)
                .find(({ id }) => id === sheet.setId)
              if (live?.completedAt === null) toggleDone(live, sheet.anchor)
            }}
            onCancel={close}
          />
        )}
        {sheet?.kind === 'finish' && <FinishConfirm workout={workout} done={done} onDone={close} />}
      </Sheet>
    </>
  )
}

// Takes the set panel's place once every set is done: what the workout came
// to, and the finish button in the thumb zone.
function DonePanel({
  done,
  volumeKg,
  records,
  onFinish,
}: {
  done: number
  volumeKg: number
  records: number
  onFinish: () => void
}) {
  const t = useTranslations('workout')
  const tHistory = useTranslations('history')
  const locale = useLocale()
  const volume = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(volumeKg)
  return (
    <div className="dock-panel flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex flex-col gap-4">
        <p className="text-body font-semibold">{t('allDone', { done })}</p>
        <p className="text-label text-ink-2">
          <span className="num">{volume}</span> {t('unit.kg')}
          {records > 0 && (
            <span className="font-semibold text-accent">
              {' · '}
              {tHistory('records', { count: records })}
            </span>
          )}
        </p>
      </div>
      <Pressable
        onClick={onFinish}
        className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
      >
        {t('finish')}
      </Pressable>
    </div>
  )
}

// Asks before completing a set ahead of the round in progress. Cancelling
// writes nothing, so a running rest carries on.
function AheadConfirm({
  body,
  resting,
  onConfirm,
  onCancel,
}: {
  body: string
  resting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useTranslations('workout')
  return (
    <div className="flex flex-col gap-20">
      <div className="flex flex-col gap-8 text-body text-ink-2">
        <p>{body}</p>
        {resting && <p>{t('aheadRest')}</p>}
      </div>
      <Pressable
        onClick={onCancel}
        className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg"
      >
        {t('aheadCancel')}
      </Pressable>
      <Pressable
        onClick={onConfirm}
        className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
      >
        {t('aheadConfirm')}
      </Pressable>
    </div>
  )
}

// Finishing keeps the workout; discarding deletes it with its sets, so it asks
// twice. A workout with no completed set is not kept: finishing it deletes it,
// so history never lists an empty workout.
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
    if (to !== '/workout') markJustFinished(workout.id)
    void write.then(() => {
      router.replace(to)
    })
  }
  const summary = `/workout/summary#${workout.id}`
  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">
        {done === 0 ? t('finishEmptyBody') : t('finishBody', { done })}
      </p>
      <Pressable
        onClick={() => {
          if (done === 0) leave(repositories.workouts.remove(workout.id), '/workout')
          else leave(workoutSession.finish(workout.id), summary)
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
      {done > 0 && (
        <Pressable
          onClick={() => {
            if (discarding) leave(repositories.workouts.remove(workout.id), '/workout')
            else setDiscarding(true)
          }}
          className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
        >
          {discarding ? t('discardConfirm', { done }) : t('discard')}
        </Pressable>
      )}
    </div>
  )
}

const loadActive = () => workoutSession.loadActive()

// The workout in progress; null when there is none, undefined while loading.
export function useActiveWorkout(): ActiveWorkoutState | null | undefined {
  return useLiveQuery(loadActive)
}
