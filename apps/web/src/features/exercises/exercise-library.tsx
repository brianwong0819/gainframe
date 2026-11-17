'use client'

import {
  BUILT_IN_EXERCISES,
  type Exercise,
  type MuscleGroup,
  muscleGroupSchema,
  type WeightUnit,
  type WorkoutSet,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { weightUnits } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { BackLink } from '@/ui/back-link'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { AddToPlan } from '../plans/add-to-plan'
import { formatSetWeight, isBodyweight } from '../workout/exercise-info'
import { ExerciseDetail } from './exercise-detail'
import { ExerciseForm } from './exercise-form'
import {
  type ExerciseDraft,
  exerciseName,
  formatRest,
  type LibraryEntry,
  libraryEntries,
  newDraft,
} from './library'
import { useBestSets } from './use-best-sets'
import { useCustomExercises } from './use-custom-exercises'

const loadWeightUnits = () => weightUnits.all()

const chipClass =
  'shrink-0 rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

interface Editing {
  exercise: Exercise | null
  initial: ExerciseDraft
}

// What the sheet shows: the detail of an exercise, or the form for a new or
// custom one.
type SheetContent = ({ kind: 'form' } & Editing) | { kind: 'detail'; exercise: LibraryEntry }

// An exercise with its muscle, equipment and default rest and, once the user
// has done it, their best set at the right.
function EntryRow({
  entry,
  best,
  unit,
  onOpen,
}: {
  entry: LibraryEntry
  best: WorkoutSet | undefined
  unit: WeightUnit
  onOpen: (entry: LibraryEntry) => void
}) {
  const t = useTranslations('exercises')
  const tWorkout = useTranslations('workout')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const locale = useLocale()
  return (
    <li className="border-t border-line first:border-t-0">
      <Pressable
        className="flex w-full items-center justify-between gap-12 py-12 text-left"
        onClick={() => {
          onOpen(entry)
        }}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-body text-ink">{exerciseName(entry, locale)}</span>
          <span className="text-label text-ink-3">
            {tMuscle(entry.muscle)} · {tEquipment(entry.equipment)}
            {' · '}
            {t('restLabel', { rest: formatRest(entry.defaultRestS) })}
            {entry.custom && ` · ${t('custom')}`}
          </span>
        </span>
        {best && (
          <span className="shrink-0 text-label text-ink-3">
            {t('best')}{' '}
            <span className="num text-ink">
              {formatSetWeight(
                best.weightKg,
                unit,
                isBodyweight(entry.equipment),
                tWorkout('bodyweight'),
              )}
              {!(isBodyweight(entry.equipment) && best.weightKg === 0) &&
                ` ${tWorkout(`unit.${unit}`)}`}
              {' × '}
              {best.reps}
            </span>
          </span>
        )}
      </Pressable>
    </li>
  )
}

export function ExerciseLibrary() {
  const t = useTranslations('exercises')
  const tForm = useTranslations('exerciseForm')
  const tDetail = useTranslations('exerciseDetail')
  const tMuscle = useTranslations('muscle')
  const custom = useCustomExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [doneOnly, setDoneOnly] = useState(false)
  const best = useBestSets()
  const units = useLiveQuery(loadWeightUnits)
  const locale = useLocale()
  const [content, setContent] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // The "done" filter is offered once an exercise has been done.
  const hasDone = best !== undefined && best.size > 0
  const entries = libraryEntries(custom ?? [], muscle, query).filter(
    ({ id }) => !(doneOnly && hasDone) || best.has(id),
  )
  const total = BUILT_IN_EXERCISES.length + (custom?.length ?? 0)

  function open(next: SheetContent) {
    setContent(next)
    setSheetOpen(true)
  }

  function edit(exercise: Exercise) {
    open({
      kind: 'form',
      exercise,
      initial: {
        nameZh: exercise.nameZh ?? '',
        nameEn: exercise.nameEn ?? '',
        muscle: exercise.muscle,
        secondaryMuscles: exercise.secondaryMuscles,
        equipment: exercise.equipment,
        defaultRestS: exercise.defaultRestS,
      },
    })
  }

  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/workout" label={t('back')} />
        <div className="flex items-end justify-between gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-title">{t('title')}</h1>
            <p className="text-label text-ink-2">{t('count', { count: total })}</p>
          </div>
          <Pressable
            onClick={() => {
              open({ kind: 'form', exercise: null, initial: newDraft('', muscle) })
            }}
            className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
          >
            {t('new')}
          </Pressable>
        </div>
      </header>

      <input
        type="search"
        value={query}
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t('searchLabel')}
        placeholder={t('search')}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        className="w-full rounded-ctl bg-surface px-16 py-12 text-input text-ink placeholder:text-ink-3"
      />

      <div role="group" aria-label={t('filterLabel')} className="flex gap-8 overflow-x-auto">
        {hasDone && (
          <Pressable
            aria-pressed={doneOnly}
            onClick={() => {
              setDoneOnly(!doneOnly)
            }}
            className={chipClass}
          >
            {t('done')}
          </Pressable>
        )}
        {[null, ...muscleGroupSchema.options].map((option) => (
          <Pressable
            key={option ?? 'all'}
            aria-pressed={option === muscle}
            onClick={() => {
              setMuscle(option)
            }}
            className={chipClass}
          >
            {option === null ? t('all') : tMuscle(option)}
          </Pressable>
        ))}
      </div>

      {custom !== undefined &&
        (entries.length > 0 ? (
          <ul className="rounded-group bg-surface px-16" aria-label={t('listLabel')}>
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                best={best?.get(entry.id)}
                unit={units?.get(entry.id) ?? 'kg'}
                onOpen={(entry) => {
                  open({ kind: 'detail', exercise: entry })
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-12 rounded-group bg-surface p-16">
            <p className="text-body text-ink-2">
              {query.trim() === '' ? t('emptyDone') : t('empty', { query: query.trim() })}
            </p>
            {query.trim() !== '' && (
              <Pressable
                onClick={() => {
                  open({ kind: 'form', exercise: null, initial: newDraft(query, muscle) })
                }}
                className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
              >
                {t('createNamed', { query: query.trim() })}
              </Pressable>
            )}
          </div>
        ))}

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        closeLabel={t('close')}
        title={
          content?.kind === 'detail'
            ? exerciseName(content.exercise, locale)
            : content?.exercise
              ? tForm('editTitle')
              : tForm('newTitle')
        }
      >
        {content?.kind === 'detail' && (
          <ExerciseDetail exercise={content.exercise}>
            <AddToPlan key={content.exercise.id} exerciseId={content.exercise.id} />
            {content.exercise.custom && (
              <Pressable
                onClick={() => {
                  const { exercise } = content
                  if (exercise.custom) edit(exercise)
                }}
                className="rounded-full bg-sunk px-20 py-16 font-semibold text-ink"
              >
                {tDetail('edit')}
              </Pressable>
            )}
          </ExerciseDetail>
        )}
        {content?.kind === 'form' && (
          <ExerciseForm
            key={content.exercise?.id ?? 'new'}
            editing={content.exercise}
            initial={content.initial}
            onDone={() => {
              setSheetOpen(false)
            }}
          />
        )}
      </Sheet>
    </main>
  )
}
