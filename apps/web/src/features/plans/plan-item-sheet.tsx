'use client'

import { type Exercise, type PlanItem, planItemSchema, suggestRestS } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { repositories } from '@/db/client'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { formatRest, REST_MAX_S, REST_STEP_S } from '../exercises/library'
import { restInfo, withRepsMax, withRepsMin } from './item-edit'

const labelClass = 'text-label text-ink-3'
const chipClass = 'rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink'

type CountField = 'targetSets' | 'repsMin' | 'repsMax'

type Changes = Partial<Pick<PlanItem, 'targetSets' | 'repsMin' | 'repsMax' | 'restS'>>

// Typed text as a whole number the item schema accepts for `field`, else null.
function parseCount(text: string, field: CountField): number | null {
  const value = Number(text.trim())
  if (text.trim() === '') return null
  return planItemSchema.shape[field].safeParse(value).success ? value : null
}

// One plan item's target sets, rep range and rest. Every change is written at
// once, like a set in a workout.
export function PlanItemSheet({
  item,
  custom,
  onRemoved,
}: {
  item: PlanItem
  custom: readonly Exercise[]
  onRemoved: () => void
}) {
  const t = useTranslations('plans')
  const { defaultRestS, mechanic } = restInfo(item.exerciseId, custom)
  const restS = item.restS ?? defaultRestS
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

  return (
    <div className="flex flex-col gap-20">
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
          {mechanic !== null && (
            <Pressable
              onClick={() => {
                save({ restS: suggestRestS(mechanic, item.repsMin) })
              }}
              className={chipClass}
            >
              {t('suggest')}
            </Pressable>
          )}
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
