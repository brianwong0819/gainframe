'use client'

import {
  type Exercise,
  linkedWithNext,
  moveItem,
  type PlanItem,
  planItemSchema,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { planStore, repositories } from '@/db/client'
import { OrderActions } from '@/ui/order-actions'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { ExerciseDetailView } from '../exercises/exercise-detail-view'
import { ExerciseInfoButton } from '../exercises/exercise-info-button'
import {
  exerciseName,
  findLibraryEntry,
  formatRest,
  REST_MAX_S,
  REST_STEP_S,
} from '../exercises/library'
import { findExercise } from '../workout/exercise-info'
import { withRepsMax, withRepsMin } from './item-edit'

const labelClass = 'text-label text-ink-3'
const chipClass = 'rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink'

type CountField = 'targetSets' | 'repsMin' | 'repsMax'

type Changes = Partial<Pick<PlanItem, 'targetSets' | 'repsMin' | 'repsMax' | 'restS' | 'note'>>

const NOTE_MAX = 500

// Typed text as a whole number the item schema accepts for `field`, else null.
function parseCount(text: string, field: CountField): number | null {
  const value = Number(text.trim())
  if (text.trim() === '') return null
  return planItemSchema.shape[field].safeParse(value).success ? value : null
}

// One plan item's target sets, rep range, rest and note. Every change is
// written at once, like a set in a workout; the note when its field loses focus
// (which closing the sheet also does).
export function PlanItemSheet({
  item,
  dayItems,
  custom,
  onRemoved,
}: {
  item: PlanItem
  // The live items of the item's day, in order.
  dayItems: readonly PlanItem[]
  custom: readonly Exercise[]
  onRemoved: () => void
}) {
  const t = useTranslations('plans')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const next = dayItems[dayItems.findIndex(({ id }) => id === item.id) + 1]
  const linked = linkedWithNext(dayItems, item.id)
  const exercise = findLibraryEntry(item.exerciseId, custom)
  const defaultRestS = exercise?.defaultRestS ?? 0
  const [showingDetail, setShowingDetail] = useState(false)
  const restS = item.restS ?? defaultRestS
  const noteId = useId()
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const save = (changes: Changes) => {
    void repositories.planItems.update(item.id, changes)
  }

  const counter = (
    label: string,
    value: number,
    min: number,
    max: number,
    field: CountField,
    onValue: (value: number) => void,
  ) => (
    <>
      <span className={labelClass}>{label}</span>
      <Stepper
        value={String(value)}
        editValue={String(value)}
        inputMode="numeric"
        label={label}
        canDecrease={value > min}
        decreaseLabel={t('less', { what: label })}
        increaseLabel={t('more', { what: label })}
        onStep={(direction) => {
          onValue(Math.min(max, Math.max(min, value + direction)))
        }}
        onEnter={(text) => {
          const parsed = parseCount(text, field)
          if (parsed !== null) onValue(parsed)
        }}
      />
    </>
  )

  if (showingDetail && exercise) {
    return (
      <div className="flex flex-col gap-16">
        <ExerciseDetailView
          exercise={exercise}
          backLabel={t('backToItem')}
          onBack={() => {
            setShowingDetail(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-20">
      {exercise && (
        <ExerciseInfoButton
          label={t('exerciseDetail')}
          showLabel
          onClick={() => {
            setShowingDetail(true)
          }}
        />
      )}
      <OrderActions
        labels={{ up: tWorkout('moveUp'), down: tWorkout('moveDown') }}
        canMove={(direction) => moveItem(dayItems, item.id, direction).length > 0}
        onMove={(direction) => {
          void planStore.moveItem(item.id, direction)
        }}
        link={
          next === undefined
            ? null
            : {
                linked,
                label: tWorkout(linked ? 'supersetSplit' : 'supersetWith', {
                  name: exerciseName(findExercise(next.exerciseId, custom), locale),
                }),
                onToggle: () => {
                  void planStore.linkWithNext(item.id, !linked)
                },
              }
        }
      />
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-12 gap-y-8">
        {counter(t('sets'), item.targetSets, 1, 20, 'targetSets', (targetSets) => {
          save({ targetSets })
        })}
        {counter(t('repsMin'), item.repsMin, 1, 100, 'repsMin', (repsMin) => {
          save(withRepsMin(item, repsMin))
        })}
        {counter(t('repsMax'), item.repsMax, 1, 100, 'repsMax', (repsMax) => {
          save(withRepsMax(item, repsMax))
        })}
      </div>
      <p className="-mt-12 text-label text-ink-2">{t('repsHint')}</p>

      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-12">
          <span className={labelClass}>{t('restLabel')}</span>
          <div className="flex items-center gap-8">
            <Pressable
              aria-label={t('restLess')}
              disabled={restS <= 0}
              onClick={() => {
                save({ restS: Math.max(0, restS - REST_STEP_S) })
              }}
              className="num rounded-full bg-sunk px-16 py-12 text-label disabled:text-ink-3"
            >
              −15s
            </Pressable>
            <output aria-live="polite" className="num min-w-0 px-8 text-section">
              {formatRest(restS)}
            </output>
            <Pressable
              aria-label={t('restMore')}
              disabled={restS >= REST_MAX_S}
              onClick={() => {
                save({ restS: Math.min(REST_MAX_S, restS + REST_STEP_S) })
              }}
              className="num rounded-full bg-sunk px-16 py-12 text-label disabled:text-ink-3"
            >
              +15s
            </Pressable>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          {item.restS === null ? (
            <span className="text-label text-ink-3">{t('restIsDefault')}</span>
          ) : (
            <Pressable
              onClick={() => {
                save({ restS: null })
              }}
              className={chipClass}
            >
              {t('useDefault', { time: formatRest(defaultRestS) })}
            </Pressable>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <label htmlFor={noteId} className={labelClass}>
          {t('planNote')}
        </label>
        <textarea
          id={noteId}
          value={noteDraft ?? item.note ?? ''}
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={t('planNotePlaceholder')}
          onChange={(event) => {
            setNoteDraft(event.target.value)
          }}
          onBlur={() => {
            if (noteDraft === null) return
            const trimmed = noteDraft.trim()
            const note = trimmed === '' ? null : trimmed
            if (note !== item.note) save({ note })
            setNoteDraft(null)
          }}
          className="w-full resize-none rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3"
        />
      </div>

      <Pressable
        onClick={() => {
          onRemoved()
          void repositories.planItems.remove(item.id)
        }}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
      >
        {t('removeItem')}
      </Pressable>
    </div>
  )
}
