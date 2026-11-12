'use client'

import type { Exercise, PlanDay, PlanItem } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { db, planStore, repositories } from '@/db/client'
import type { PlanDayState, PlanState } from '@/db/plans'
import { useLiveQuery } from '@/db/use-live-query'
import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { exerciseName, formatRest, type LibraryEntry } from '../exercises/library'
import { findExercise } from '../workout/exercise-info'
import { formatRepRange } from './item-edit'
import { NameField } from './name-field'
import { PlanExercisePicker } from './plan-exercise-picker'
import { PlanItemSheet } from './plan-item-sheet'

// Custom exercises including deleted ones, so names never go missing.
const allCustomExercises = (): Promise<Exercise[]> => db.exercises.toArray()

const quietButtonClass =
  'self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2'

type SheetContent =
  { kind: 'picker'; day: PlanDay; picked: LibraryEntry | null } | { kind: 'item'; itemId: string }

// A button that asks once more before it acts.
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  return (
    <Pressable
      onClick={() => {
        if (asking) onConfirm()
        else setAsking(true)
      }}
      className={quietButtonClass}
    >
      {asking ? confirmLabel : label}
    </Pressable>
  )
}

function Day({
  state,
  n,
  custom,
  onAddExercise,
  onOpenItem,
}: {
  state: PlanDayState
  n: number
  custom: readonly Exercise[]
  onAddExercise: () => void
  onOpenItem: (item: PlanItem) => void
}) {
  const t = useTranslations('plans')
  const locale = useLocale()
  const { day, items } = state
  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <NameField
        value={day.name}
        label={t('dayNameLabel', { n })}
        onSave={(name) => {
          void repositories.planDays.update(day.id, { name })
        }}
        className="-mx-8 px-8 py-4 text-input font-semibold"
      />
      {items.length === 0 && <p className="text-body text-ink-2">{t('noItems')}</p>}
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id} className="border-t border-line first:border-t-0">
              <Pressable
                onClick={() => {
                  onOpenItem(item)
                }}
                className="flex w-full items-center justify-between gap-12 py-12 text-left"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-body text-ink">
                    {exerciseName(findExercise(item.exerciseId, custom), locale)}
                  </span>
                  <span className="text-label text-ink-3">
                    {t('itemSummary', { sets: item.targetSets, reps: formatRepRange(item) })}
                    {' · '}
                    {item.restS === null
                      ? t('restDefault')
                      : t('rest', { time: formatRest(item.restS) })}
                  </span>
                </span>
                <span className="text-ink-3">
                  <Chevron direction="right" />
                </span>
              </Pressable>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-8">
        <Pressable
          onClick={onAddExercise}
          className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
        >
          {t('addExercise')}
        </Pressable>
        <ConfirmButton
          label={t('deleteDay')}
          confirmLabel={t('deleteDayConfirm', { name: day.name })}
          onConfirm={() => {
            void repositories.planDays.remove(day.id)
          }}
        />
      </div>
    </section>
  )
}

// A plan's name, whether it is the active one, and its days in rotation
// order, each with its exercises.
export function PlanEditor({ state }: { state: PlanState }) {
  const t = useTranslations('plans')
  const locale = useLocale()
  const router = useRouter()
  const custom = useLiveQuery(allCustomExercises) ?? []
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { plan, active, days } = state
  const open = (content: SheetContent) => {
    setSheet(content)
    setSheetOpen(true)
  }
  // The sheet shows the live item, so a change shows at once.
  const sheetItem =
    sheet?.kind === 'item'
      ? days.flatMap(({ items }) => items).find((item) => item.id === sheet.itemId)
      : undefined
  const sheetTitle =
    sheet?.kind === 'picker'
      ? sheet.picked
        ? exerciseName(sheet.picked, locale)
        : t('pickerTitle', { day: sheet.day.name })
      : sheetItem
        ? exerciseName(findExercise(sheetItem.exerciseId, custom), locale)
        : ''

  return (
    <>
      <NameField
        value={plan.name}
        label={t('planName')}
        onSave={(name) => {
          void repositories.plans.update(plan.id, { name })
        }}
        className="-mx-8 px-8 text-title"
      />
      {active ? (
        <p className="text-label text-ink-3">{t('isActive')}</p>
      ) : (
        <Pressable
          onClick={() => {
            void planStore.setActivePlan(plan.id)
          }}
          className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
        >
          {t('makeActive')}
        </Pressable>
      )}
      {days.map((dayState, index) => (
        <Day
          key={dayState.day.id}
          state={dayState}
          n={index + 1}
          custom={custom}
          onAddExercise={() => {
            open({ kind: 'picker', day: dayState.day, picked: null })
          }}
          onOpenItem={(item) => {
            open({ kind: 'item', itemId: item.id })
          }}
        />
      ))}
      <Pressable
        onClick={() => {
          void planStore.addDay(plan.id, t('dayName', { n: days.length + 1 }))
        }}
        className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
      >
        {t('addDay')}
      </Pressable>
      <ConfirmButton
        label={t('deletePlan')}
        confirmLabel={t('deletePlanConfirm')}
        onConfirm={() => {
          void repositories.plans.remove(plan.id).then(() => {
            router.replace('/workout/plans')
          })
        }}
      />
      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        closeLabel={t('close')}
        title={sheetTitle}
      >
        {sheet?.kind === 'picker' && (
          <PlanExercisePicker
            day={sheet.day}
            picked={sheet.picked}
            onPick={(picked) => {
              setSheet({ ...sheet, picked })
            }}
            onBack={() => {
              setSheet({ ...sheet, picked: null })
            }}
            onAdd={({ id }) => {
              setSheetOpen(false)
              void planStore.addItem(sheet.day.id, id)
            }}
          />
        )}
        {sheetItem && (
          <PlanItemSheet
            key={sheetItem.id}
            item={sheetItem}
            custom={custom}
            onRemoved={() => {
              setSheetOpen(false)
            }}
          />
        )}
      </Sheet>
    </>
  )
}
