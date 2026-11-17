'use client'

import { type Exercise, type PlanItem, planItemSchema, supersetValue } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { planStore } from '@/db/client'
import { Stepper } from '@/ui/stepper'

import { itemRestS } from './estimate'
import { RestStepper } from './rest-stepper'

const ROUNDS_MAX = 20

// The settings that belong to a whole superset rather than one exercise: how
// many rounds (each a set of every member in turn) and the rest after each
// round. Every member stores the same values, so each change goes to all.
export function SupersetSheet({
  members,
  names,
  custom,
}: {
  // The superset's live items, in order.
  members: readonly PlanItem[]
  names: readonly string[]
  custom: readonly Exercise[]
}) {
  const t = useTranslations('plans')
  const [first] = members
  if (first === undefined) return null
  const rounds = supersetValue(members, (item) => item.targetSets)
  const restS = supersetValue(members, (item) => itemRestS(item, custom))
  const save = (changes: Partial<Pick<PlanItem, 'restS' | 'targetSets'>>) => {
    void planStore.updateSuperset(first.id, changes)
  }
  const setRounds = (value: number) => {
    save({ targetSets: Math.min(ROUNDS_MAX, Math.max(1, value)) })
  }

  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">{t('supersetHint', { order: names.join(' → ') })}</p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-12">
        <span className="text-label text-ink-3">{t('rounds')}</span>
        <Stepper
          value={String(rounds)}
          editValue={String(rounds)}
          inputMode="numeric"
          label={t('rounds')}
          canDecrease={rounds > 1}
          decreaseLabel={t('less', { what: t('rounds') })}
          increaseLabel={t('more', { what: t('rounds') })}
          onStep={(direction) => {
            setRounds(rounds + direction)
          }}
          onEnter={(text) => {
            const value = Number(text.trim())
            if (text.trim() !== '' && planItemSchema.shape.targetSets.safeParse(value).success) {
              setRounds(value)
            }
          }}
        />
      </div>
      <RestStepper
        label={t('roundRest')}
        restS={restS}
        lessLabel={t('restLess')}
        moreLabel={t('restMore')}
        onChange={(value) => {
          save({ restS: value })
        }}
      />
    </div>
  )
}
