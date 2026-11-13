'use client'

import type { PlanDay } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef } from 'react'

import { Pressable } from '@/ui/pressable'

import { ExerciseDetailView } from '../exercises/exercise-detail-view'
import type { LibraryEntry } from '../exercises/library'
import { ExercisePicker } from '../workout/exercise-picker'

// Adding an exercise to a plan day: the library list, and on a tap the same
// detail as the library (muscle map, cues) with a button that adds it. The list
// stays mounted while the detail shows, so its search survives "back", and its
// scroll position is restored.
export function PlanExercisePicker({
  day,
  picked,
  onPick,
  onBack,
  onAdd,
}: {
  day: PlanDay
  picked: LibraryEntry | null
  onPick: (exercise: LibraryEntry) => void
  onBack: () => void
  onAdd: (exercise: LibraryEntry) => void
}) {
  const t = useTranslations('plans')
  const root = useRef<HTMLDivElement>(null)
  const listScrollTop = useRef(0)
  // The scrolling element is the sheet's panel (src/ui/sheet.tsx).
  const panel = () => root.current?.closest('.sheet-panel') ?? null

  useLayoutEffect(() => {
    const element = panel()
    if (element && picked === null) element.scrollTop = listScrollTop.current
  }, [picked])

  return (
    <div ref={root} className="flex flex-col gap-16">
      <div hidden={picked !== null}>
        <ExercisePicker
          onPick={(exercise) => {
            listScrollTop.current = panel()?.scrollTop ?? 0
            onPick(exercise)
          }}
        />
      </div>
      {picked && (
        <ExerciseDetailView exercise={picked} backLabel={t('backToPicker')} onBack={onBack}>
          <div className="sheet-footer">
            <Pressable
              onClick={() => {
                onAdd(picked)
              }}
              className="w-full rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
            >
              {t('addToDay', { day: day.name })}
            </Pressable>
          </div>
        </ExerciseDetailView>
      )}
    </div>
  )
}
