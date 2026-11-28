'use client'

import {
  type Equipment,
  equipmentSchema,
  type Exercise,
  type MuscleGroup,
  muscleGroupSchema,
} from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { repositories } from '@/db/client'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'

import {
  draftToExercise,
  type ExerciseDraft,
  formatRest,
  pickMuscle,
  REST_MAX_S,
  REST_STEP_S,
} from './library'
import { MuscleMap, roleLevels } from './muscle-map'

const fieldClass =
  'w-full rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3'
const groupLabelClass = 'text-label text-ink-3'
// Picked muscles take the map's colours: the accent for the primary one, the
// soft accent for secondary ones.
const muscleChipClass =
  'rounded-full border border-line px-16 py-8 text-label text-ink-2 data-[role=primary]:border-accent data-[role=primary]:bg-accent data-[role=primary]:text-accent-ink data-[role=secondary]:border-accent-soft data-[role=secondary]:bg-accent-soft data-[role=secondary]:text-ink'

// Muscles picked on the map or with the buttons below it (see pickMuscle).
function MusclePicker({
  draft,
  onPick,
  missing,
  errorId,
}: {
  draft: ExerciseDraft
  onPick: (muscle: MuscleGroup) => void
  missing: boolean
  errorId: string
}) {
  const t = useTranslations('exerciseForm')
  const tMuscle = useTranslations('muscle')
  const labelId = useId()
  const hintId = useId()
  const roleOf = (muscle: MuscleGroup) =>
    muscle === draft.muscle
      ? 'primary'
      : draft.secondaryMuscles.includes(muscle)
        ? 'secondary'
        : undefined
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={missing ? `${hintId} ${errorId}` : hintId}
      className="flex flex-col gap-12"
    >
      <div className="flex flex-col gap-4">
        <span id={labelId} className={groupLabelClass}>
          {t('muscle')}
        </span>
        <span id={hintId} className="text-label text-ink-2">
          {t('muscleHint')}
        </span>
      </div>
      <div className="px-20">
        <MuscleMap
          levels={roleLevels(draft.muscle, draft.secondaryMuscles)}
          label={t('mapLabel')}
          onPick={onPick}
        />
      </div>
      <div className="flex flex-wrap gap-8">
        {muscleGroupSchema.options.map((muscle) => {
          const role = roleOf(muscle)
          return (
            <Pressable
              key={muscle}
              aria-pressed={role !== undefined}
              data-role={role}
              onClick={() => {
                onPick(muscle)
              }}
              className={muscleChipClass}
            >
              {tMuscle(muscle)}
              {role && <span className="sr-only">{` (${t(role)})`}</span>}
            </Pressable>
          )
        })}
      </div>
      {missing && (
        <p id={errorId} role="alert" className="text-label text-short">
          {t('muscleRequired')}
        </p>
      )}
    </div>
  )
}

// The new / edit form for a custom exercise. `initial` is the exercise being
// edited, or the starting values of a new one.
export function ExerciseForm({
  editing,
  initial,
  onDone,
}: {
  editing: Exercise | null
  initial: ExerciseDraft
  onDone: (exercise: Exercise) => void
}) {
  const t = useTranslations('exerciseForm')
  const tEquipment = useTranslations('equipment')
  const [draft, setDraft] = useState(initial)
  const [missingName, setMissingName] = useState(false)
  const [missingMuscle, setMissingMuscle] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameZhId = useId()
  const nameEnId = useId()
  const errorId = useId()
  const muscleErrorId = useId()

  const set = <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    const { muscle } = draft
    const values = muscle === null ? null : draftToExercise({ ...draft, muscle })
    const noName = draft.nameZh.trim() === '' && draft.nameEn.trim() === ''
    setMissingName(noName)
    setMissingMuscle(values === null)
    if (noName || values === null) return
    setSaving(true)
    try {
      onDone(
        editing
          ? await repositories.exercises.update(editing.id, values)
          : await repositories.exercises.create(values),
      )
    } finally {
      setSaving(false)
    }
  }

  const nameField = (id: string, key: 'nameZh' | 'nameEn', lang: string) => (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className={groupLabelClass}>
        {t(key)}
      </label>
      <input
        id={id}
        lang={lang}
        value={draft[key]}
        maxLength={80}
        autoComplete="off"
        placeholder={t(`${key}Placeholder`)}
        aria-invalid={missingName}
        aria-describedby={missingName ? errorId : undefined}
        onChange={(event) => {
          set(key, event.target.value)
          setMissingName(false)
        }}
        className={fieldClass}
      />
    </div>
  )

  return (
    <form
      className="flex flex-col gap-20"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {nameField(nameZhId, 'nameZh', 'zh-Hans')}
      {nameField(nameEnId, 'nameEn', 'en')}
      {missingName && (
        <p id={errorId} role="alert" className="-mt-8 text-label text-short">
          {t('nameRequired')}
        </p>
      )}

      <MusclePicker
        draft={draft}
        missing={missingMuscle}
        errorId={muscleErrorId}
        onPick={(muscle) => {
          setDraft((current) => ({ ...current, ...pickMuscle(current, muscle) }))
          setMissingMuscle(false)
        }}
      />
      <ChoiceGroup<Equipment>
        label={t('equipment')}
        options={equipmentSchema.options}
        value={draft.equipment}
        onChange={(value) => {
          set('equipment', value)
        }}
        optionLabel={(option) => tEquipment(option)}
      />

      <div className="flex items-center justify-between gap-12">
        <span className={groupLabelClass}>{t('rest')}</span>
        <div className="flex items-center gap-8">
          <Pressable
            aria-label={t('restLess')}
            disabled={draft.defaultRestS <= 0}
            onClick={() => {
              set('defaultRestS', Math.max(0, draft.defaultRestS - REST_STEP_S))
            }}
            className="num rounded-full bg-sunk px-16 py-12 text-label disabled:text-ink-3"
          >
            −15s
          </Pressable>
          <output aria-live="polite" className="num min-w-0 px-8 text-section">
            {formatRest(draft.defaultRestS)}
          </output>
          <Pressable
            aria-label={t('restMore')}
            disabled={draft.defaultRestS >= REST_MAX_S}
            onClick={() => {
              set('defaultRestS', Math.min(REST_MAX_S, draft.defaultRestS + REST_STEP_S))
            }}
            className="num rounded-full bg-sunk px-16 py-12 text-label disabled:text-ink-3"
          >
            +15s
          </Pressable>
        </div>
      </div>

      <Pressable
        type="submit"
        disabled={saving}
        className="rounded-full bg-accent px-20 py-16 font-semibold text-accent-ink"
      >
        {t('save')}
      </Pressable>
    </form>
  )
}
