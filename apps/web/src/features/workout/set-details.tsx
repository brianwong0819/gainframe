'use client'

import { setKindSchema, type SetKind, type WorkoutSet } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { repositories } from '@/db/client'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'

// RPE on the half-point scale people actually use; below 6 is a warm-up.
const RPE_OPTIONS = ['none', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'] as const
type RpeOption = (typeof RPE_OPTIONS)[number]

function toOption(rpe: number | null): RpeOption {
  return RPE_OPTIONS.find((option) => option === String(rpe)) ?? 'none'
}

// The set's kind and RPE, and deleting it. Changes are saved as they are picked.
export function SetDetails({ set, onDeleted }: { set: WorkoutSet; onDeleted: () => void }) {
  const t = useTranslations('workout')
  const tKind = useTranslations('setKind')
  const save = (changes: Partial<Pick<WorkoutSet, 'kind' | 'rpe'>>) => {
    void repositories.workoutSets.update(set.id, changes)
  }

  return (
    <div className="flex flex-col gap-20">
      <ChoiceGroup<SetKind>
        label={t('kind')}
        options={setKindSchema.options}
        value={set.kind}
        onChange={(kind) => {
          save({ kind })
        }}
        optionLabel={(kind) => tKind(kind)}
      />
      <ChoiceGroup<RpeOption>
        label={t('rpe')}
        options={RPE_OPTIONS}
        value={toOption(set.rpe)}
        onChange={(option) => {
          save({ rpe: option === 'none' ? null : Number(option) })
        }}
        optionLabel={(option) => (option === 'none' ? t('rpeNone') : option)}
      />
      <p className="text-label text-ink-3">{t('rpeHint')}</p>
      <Pressable
        onClick={() => {
          onDeleted()
          void repositories.workoutSets.remove(set.id)
        }}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
      >
        {t('deleteSet')}
      </Pressable>
    </div>
  )
}
