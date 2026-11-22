'use client'

import { domainConfig } from '@gainframe/shared'
import { useTranslations } from 'next-intl'

import { db, repositories } from '@/db/client'
import { type DailyTargets, saveTargets } from '@/db/profile'
import { Sheet } from '@/ui/sheet'
import { Stepper } from '@/ui/stepper'

import { parseKcalTarget, parseProteinTarget } from './targets'

const { startProteinG, startKcal, proteinStepG, kcalStep } = domainConfig.targets

// The protein and energy targets the Food tab and Today measure against,
// opened from the day card. Each change is saved at once; until the first one
// the steppers show where most lifters start, and nothing is stored.
export function TargetsSheet({
  open,
  onClose,
  targets,
}: {
  open: boolean
  onClose: () => void
  targets: DailyTargets | null
}) {
  const t = useTranslations('targets')
  const shown = targets ?? { proteinG: startProteinG, kcal: startKcal }
  const save = (changes: Partial<DailyTargets>) => {
    void saveTargets(db, repositories, { ...shown, ...changes })
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={t('close')}>
      <div className="flex flex-col gap-16">
        <p className="text-label text-ink-2">{targets === null ? t('notSet') : t('hint')}</p>
        <div className="flex flex-col gap-8">
          <span className="text-label text-ink-3">{t('proteinPerDay')}</span>
          <Stepper
            value={String(shown.proteinG)}
            editValue={String(shown.proteinG)}
            inputMode="decimal"
            label={t('protein')}
            onEnter={(text) => {
              const proteinG = parseProteinTarget(text)
              if (proteinG !== null) save({ proteinG })
            }}
            canDecrease={shown.proteinG > proteinStepG}
            decreaseLabel={t('proteinDown')}
            increaseLabel={t('proteinUp')}
            onStep={(direction) => {
              save({ proteinG: shown.proteinG + direction * proteinStepG })
            }}
          />
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-label text-ink-3">{t('energyPerDay')}</span>
          <Stepper
            value={String(shown.kcal)}
            editValue={String(shown.kcal)}
            inputMode="numeric"
            label={t('energy')}
            onEnter={(text) => {
              const kcal = parseKcalTarget(text)
              if (kcal !== null) save({ kcal })
            }}
            canDecrease={shown.kcal > kcalStep}
            decreaseLabel={t('energyDown')}
            increaseLabel={t('energyUp')}
            onStep={(direction) => {
              save({ kcal: shown.kcal + direction * kcalStep })
            }}
          />
        </div>
      </div>
    </Sheet>
  )
}
