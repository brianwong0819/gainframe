'use client'

import {
  type Exercise,
  linkedWithNext,
  moveItem,
  type PlanItem,
  planItemSchema,
  supersetBlocks,
  supersetValue,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { planStore, repositories } from '@/db/client'
import { Chevron } from '@/ui/chevron'
import { OrderActions } from '@/ui/order-actions'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { ExerciseDetailView } from '../exercises/exercise-detail-view'
import { ExerciseInfoButton } from '../exercises/exercise-info-button'
import { exerciseName, findLibraryEntry, formatRest } from '../exercises/library'
import { findExercise } from '../workout/exercise-info'
import { itemRestS } from './estimate'
import { withRepsMax, withRepsMin } from './item-edit'
import { RestStepper } from './rest-stepper'

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
// (which closing the sheet also does). In a superset the sets and rest belong
// to the superset, so the sheet links to its settings instead, and joining the
// item with the next one opens them.
export function PlanItemSheet({
  item,
  dayItems,
  custom,
  onRemoved,
  onOpenSuperset,
}: {
  item: PlanItem
  // The live items of the item's day, in order.
  dayItems: readonly PlanItem[]
  custom: readonly Exercise[]
  onRemoved: () => void
  onOpenSuperset: () => void
}) {
  const t = useTranslations('plans')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const next = dayItems[dayItems.findIndex(({ id }) => id === item.id) + 1]
  const linked = linkedWithNext(dayItems, item.id)
  // The item's superset, whose rounds and rest are its own.
  const superset = supersetBlocks(dayItems).find(
    ({ letter, items }) => letter !== null && items.some(({ id }) => id === item.id),
  )
  const exercise = findLibraryEntry(item.exerciseId, custom)
  const defaultRestS = exercise?.defaultRestS ?? 0
  const [showingDetail, setShowingDetail] = useState(false)
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
                  void planStore.linkWithNext(item.id, !linked).then(() => {
                    if (!linked) onOpenSuperset()
                  })
                },
              }
        }
      />
      {superset && (
        <Pressable
          onClick={onOpenSuperset}
          className="flex items-center justify-between gap-12 rounded-ctl bg-accent-wash px-16 py-12 text-left"
        >
          <span className="flex flex-col">
            <span className="text-body text-ink">
              {t('supersetSummary', {
                rounds: supersetValue(superset.items, ({ targetSets }) => targetSets),
                time: formatRest(
                  supersetValue(superset.items, (member) => itemRestS(member, custom)),
                ),
              })}
            </span>
            <span className="text-label text-accent">
              {t('setBySuperset', { letter: superset.letter ?? '' })}
            </span>
          </span>
          <span className="text-ink-3">
            <Chevron direction="right" />
          </span>
        </Pressable>
      )}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-12 gap-y-8">
        {!superset &&
          counter(t('sets'), item.targetSets, 1, 20, 'targetSets', (targetSets) => {
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

      {!superset && (
        <div className="flex flex-col gap-8">
          <RestStepper
            label={t('restLabel')}
            restS={itemRestS(item, custom)}
            lessLabel={t('restLess')}
            moreLabel={t('restMore')}
            onChange={(restS) => {
              save({ restS })
            }}
          />
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
      )}

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
