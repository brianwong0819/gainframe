'use client'

import { domainConfig } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { db, repositories } from '@/db/client'
import {
  applyEstimate,
  type CalculatorAnswers,
  currentProfile,
  type DailyTargets,
  latestBodyMetric,
  saveTargets,
} from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { Stepper } from '@/ui/stepper'

import { TargetCalculator } from './target-calculator'
import { parseKcalTarget, parseProteinTarget } from './targets'

const { startProteinG, startKcal, proteinStepG, kcalStep } = domainConfig.targets
const { start } = domainConfig.estimate

const readAnswers = async (): Promise<
  Omit<CalculatorAnswers, 'birthYear'> & { birthYear: number | null }
> => {
  const [profile, weighIn] = await Promise.all([currentProfile(db), latestBodyMetric(db)])
  return {
    sex: profile?.sex ?? 'male',
    birthYear: profile?.birthYear ?? null,
    heightCm: profile?.heightCm ?? start.heightCm,
    weightKg: weighIn?.weightKg ?? start.weightKg,
    activityLevel: profile?.activityLevel ?? 'moderate',
    phase: profile?.phase ?? 'bulk',
  }
}

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
  const [calculating, setCalculating] = useState(false)
  const answers = useLiveQuery(readAnswers)
  const year = new Date().getFullYear()
  const shown = targets ?? { proteinG: startProteinG, kcal: startKcal }
  const save = (changes: Partial<DailyTargets>) => {
    void saveTargets(db, repositories, { ...shown, ...changes })
  }
  const close = () => {
    setCalculating(false)
    onClose()
  }
  return (
    <Sheet open={open} onClose={close} title={t('title')} closeLabel={t('close')}>
      {calculating && answers !== undefined ? (
        <TargetCalculator
          initial={{ ...answers, birthYear: answers.birthYear ?? year - start.ageYears }}
          year={year}
          onBack={() => {
            setCalculating(false)
          }}
          onApply={(chosen, estimate) => {
            void applyEstimate(db, repositories, {
              answers: chosen,
              targets: estimate,
              measuredAt: new Date().toISOString(),
              timeZone: deviceTimeZone(),
            }).then(() => {
              setCalculating(false)
            })
          }}
        />
      ) : (
        <div className="flex flex-col gap-16">
          {answers !== undefined && (
            <Pressable
              onClick={() => {
                setCalculating(true)
              }}
              className="flex items-center justify-between gap-12 rounded-group bg-surface px-16 py-12 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-body font-semibold text-ink">{t('calculate')}</span>
                <span className="text-label text-ink-3">
                  {answers.birthYear === null ? t('calculateHint') : t('recalculateHint')}
                </span>
              </span>
              <span className="text-ink-3">
                <Chevron direction="right" />
              </span>
            </Pressable>
          )}
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
      )}
    </Sheet>
  )
}
