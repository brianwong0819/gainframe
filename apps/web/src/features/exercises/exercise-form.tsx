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
import { Pressable } from '@/ui/pressable'

import { draftToExercise, type ExerciseDraft, formatRest, REST_MAX_S, REST_STEP_S } from './library'

const fieldClass =
  'w-full rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3'
const chipClass =
  'rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'
const groupLabelClass = 'text-label text-ink-3'

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  optionLabel: (option: T) => string
}) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-8">
      <span id={labelId} className={groupLabelClass}>
        {label}
      </span>
      <div className="flex flex-wrap gap-8">
        {options.map((option) => (
          <Pressable
            key={option}
            aria-pressed={option === value}
            onClick={() => {
              onChange(option)
            }}
            className={chipClass}
          >
            {optionLabel(option)}
          </Pressable>
        ))}
      </div>
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
  onDone: () => void
}) {
  const t = useTranslations('exerciseForm')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const [draft, setDraft] = useState(initial)
  const [missingName, setMissingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameZhId = useId()
  const nameEnId = useId()
  const errorId = useId()

  const set = <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    const values = draftToExercise(draft)
    if (values.nameZh === null && values.nameEn === null) {
      setMissingName(true)
      return
    }
    setSaving(true)
    try {
      if (editing) await repositories.exercises.update(editing.id, values)
      else await repositories.exercises.create(values)
      onDone()
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

      <ChoiceGroup<MuscleGroup>
        label={t('muscle')}
        options={muscleGroupSchema.options}
        value={draft.muscle}
        onChange={(value) => {
          set('muscle', value)
        }}
        optionLabel={(option) => tMuscle(option)}
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
