'use client'

import { domainConfig } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { db, repositories } from '@/db/client'
import { currentProfile, type DailyTargets as Targets, saveTargets } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { Stepper } from '@/ui/stepper'

import { parseKcalTarget, parseProteinTarget } from './targets'

const { startProteinG, startKcal, proteinStepG, kcalStep } = domainConfig.targets

const readProfile = () => currentProfile(db).then((profile) => profile ?? null)

// The protein and energy targets the Food tab and Today measure against. Each
// change is saved at once; until the first one the steppers show where most
// lifters start, and nothing is stored.
export function DailyTargets() {
  const t = useTranslations('targets')
  const profile = useLiveQuery(readProfile)
  if (profile === undefined) return null
  const targets: Targets =
    profile === null
      ? { proteinG: startProteinG, kcal: startKcal }
      : { proteinG: profile.proteinValue, kcal: profile.kcalTarget }
  const save = (changes: Partial<Targets>) => {
    void saveTargets(db, repositories, { ...targets, ...changes })
  }
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-label text-ink-3">{t('title')}</h2>
      <div className="flex flex-col gap-16 rounded-group bg-surface p-16">
        <p className="text-label text-ink-2">{profile === null ? t('notSet') : t('hint')}</p>
        <div className="flex flex-col gap-8">
          <span className="text-label text-ink-3">{t('proteinPerDay')}</span>
          <Stepper
            value={String(targets.proteinG)}
            editValue={String(targets.proteinG)}
            inputMode="decimal"
            label={t('protein')}
            onEnter={(text) => {
              const proteinG = parseProteinTarget(text)
              if (proteinG !== null) save({ proteinG })
            }}
            canDecrease={targets.proteinG > proteinStepG}
            decreaseLabel={t('proteinDown')}
            increaseLabel={t('proteinUp')}
            onStep={(direction) => {
              save({ proteinG: targets.proteinG + direction * proteinStepG })
            }}
          />
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-label text-ink-3">{t('energyPerDay')}</span>
          <Stepper
            value={String(targets.kcal)}
            editValue={String(targets.kcal)}
            inputMode="numeric"
            label={t('energy')}
            onEnter={(text) => {
              const kcal = parseKcalTarget(text)
              if (kcal !== null) save({ kcal })
            }}
            canDecrease={targets.kcal > kcalStep}
            decreaseLabel={t('energyDown')}
            increaseLabel={t('energyUp')}
            onStep={(direction) => {
              save({ kcal: targets.kcal + direction * kcalStep })
            }}
          />
        </div>
      </div>
    </section>
  )
}
