'use client'

import type { WorkoutSet } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import type { SlotState } from '@/db/workout-session'
import { Pressable } from '@/ui/pressable'

import { exerciseName } from '../exercises/library'
import { type ExerciseInfo, formatKg, isBodyweight } from './exercise-info'

interface SetTableProps {
  state: SlotState
  exercise: ExerciseInfo
  selectedId: string | null
  onSelect: (set: WorkoutSet, n: number) => void
  onToggle: (set: WorkoutSet) => void
  onAddSet: () => void
  onNote: () => void
}

const columns = 'grid grid-cols-[2fr_3fr_3fr_3fr_auto] items-center gap-8'

function Check({ done }: { done: boolean }) {
  return (
    <span
      className={`flex size-40 items-center justify-center rounded-full border ${done ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-3'}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-20 fill-none stroke-current"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 12.5l4 4L18 8" />
      </svg>
    </span>
  )
}

// One exercise of the workout: its sets with last time's numbers beside them.
// Tapping a row selects the set for the panel, or opens a done set's details;
// the check completes it.
export function SetTable({
  state,
  exercise,
  selectedId,
  onSelect,
  onToggle,
  onAddSet,
  onNote,
}: SetTableProps) {
  const t = useTranslations('workout')
  const tShort = useTranslations('setKindShort')
  const locale = useLocale()
  const bodyweight = isBodyweight(exercise.equipment)
  const weight = (kg: number) =>
    bodyweight ? (kg === 0 ? t('bodyweight') : `+${formatKg(kg)}`) : formatKg(kg)

  return (
    <section className="flex flex-col gap-8 rounded-group bg-surface p-16">
      <div className="flex items-start justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="text-body font-semibold text-ink">{exerciseName(exercise, locale)}</h2>
          {state.slot.note !== null && (
            <p className="text-label whitespace-pre-line text-ink-2">{state.slot.note}</p>
          )}
        </div>
        <Pressable
          onClick={onNote}
          className="shrink-0 rounded-full bg-sunk px-12 py-8 text-label font-semibold text-ink"
        >
          {t('note')}
        </Pressable>
      </div>
      <div className={`${columns} text-label text-ink-3`} aria-hidden>
        <span>{t('colSet')}</span>
        <span>{t('colLast')}</span>
        <span>{bodyweight ? t('colLoad') : t('colWeight')}</span>
        <span>{t('colReps')}</span>
        <span className="box-content w-40 px-4" />
      </div>
      <ol className="flex flex-col">
        {state.sets.map((set, index) => {
          const n = index + 1
          const last = state.previous[index]
          const done = set.completedAt !== null
          return (
            <li
              key={set.id}
              className={`${columns} rounded-ctl ${set.id === selectedId ? 'bg-accent-wash' : ''}`}
            >
              <Pressable
                className="col-span-4 grid grid-cols-subgrid items-center py-4 text-left"
                aria-pressed={set.id === selectedId}
                aria-label={`${t('colSet')} ${String(n)}`}
                onClick={() => {
                  onSelect(set, n)
                }}
              >
                <span className="num pl-8 text-label text-ink-3">
                  {set.kind === 'working' ? n : tShort(set.kind)}
                </span>
                <span className="num text-label text-ink-3">
                  {last ? `${weight(last.weightKg)}×${String(last.reps)}` : t('lastNone')}
                </span>
                <span className={`num text-body ${done ? 'text-ink' : 'text-ink-2'}`}>
                  {weight(set.weightKg)}
                </span>
                <span className={`num text-body ${done ? 'text-ink' : 'text-ink-2'}`}>
                  {set.reps}
                </span>
              </Pressable>
              <Pressable
                className="p-4"
                aria-label={done ? t('undo', { n }) : t('complete', { n })}
                aria-pressed={done}
                onClick={() => {
                  onToggle(set)
                }}
              >
                <Check done={done} />
              </Pressable>
            </li>
          )
        })}
      </ol>
      <Pressable
        onClick={onAddSet}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
      >
        {t('addSet')}
      </Pressable>
    </section>
  )
}
