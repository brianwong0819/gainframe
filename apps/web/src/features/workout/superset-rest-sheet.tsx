'use client'

import { type Exercise, supersetValue, type WorkoutExercise } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { workoutSession } from '@/db/client'

import { itemRestS } from '../plans/estimate'
import { RestStepper } from '../plans/rest-stepper'

// A superset's rest in this workout, taken after each round. The number of
// rounds is the number of sets, which "add round" on the cards changes.
export function SupersetRestSheet({
  members,
  names,
  custom,
}: {
  // The superset's live slots, in order.
  members: readonly WorkoutExercise[]
  names: readonly string[]
  custom: readonly Exercise[]
}) {
  const t = useTranslations('workout')
  const [first] = members
  if (first === undefined) return null
  return (
    <div className="flex flex-col gap-20">
      <p className="text-body text-ink-2">{t('supersetHint', { order: names.join(' → ') })}</p>
      <RestStepper
        label={t('roundRest')}
        restS={supersetValue(members, (slot) => itemRestS(slot, custom))}
        lessLabel={t('restLess', { s: 15 })}
        moreLabel={t('restMore', { s: 15 })}
        onChange={(restS) => {
          void workoutSession.setSupersetRest(first.id, restS)
        }}
      />
    </div>
  )
}
