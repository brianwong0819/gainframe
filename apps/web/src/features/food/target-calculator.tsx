'use client'

import {
  type ActivityLevel,
  activityLevelSchema,
  domainConfig,
  estimateTargets,
  type Phase,
  phaseSchema,
  sexSchema,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'

import type { CalculatorAnswers } from '@/db/profile'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'
import { SheetBack } from '@/ui/sheet-back'
import { Stepper } from '@/ui/stepper'

import { parseBirthYear, parseHeightCm, parseWeightKg } from './targets'

const { proteinGPerKg, step } = domainConfig.estimate

function hero(chunks: ReactNode) {
  return <span className="num text-section text-ink">{chunks}</span>
}

function NumberField({
  label,
  value,
  inputMode,
  parse,
  onChange,
  stepBy,
  decreaseLabel,
  increaseLabel,
}: {
  label: string
  value: number
  inputMode: 'decimal' | 'numeric'
  parse: (text: string) => number | null
  onChange: (value: number) => void
  stepBy: number
  decreaseLabel: string
  increaseLabel: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <span className="text-label text-ink-3">{label}</span>
      <Stepper
        value={String(value)}
        editValue={String(value)}
        inputMode={inputMode}
        label={label}
        onEnter={(text) => {
          const parsed = parse(text)
          if (parsed !== null) onChange(parsed)
        }}
        canDecrease={parse(String(value - stepBy)) !== null}
        decreaseLabel={decreaseLabel}
        increaseLabel={increaseLabel}
        onStep={(direction) => {
          const next = Math.round((value + direction * stepBy) * 10) / 10
          if (parse(String(next)) !== null) onChange(next)
        }}
      />
    </div>
  )
}

// The target calculator (M4-01, moved forward on 2026-11-23): a few answers
// and a phase give protein and energy targets, shown with how they were
// reached. Nothing is saved until "Use these targets"; the steppers of the
// targets sheet can change the result afterwards.
export function TargetCalculator({
  initial,
  year,
  onBack,
  onApply,
}: {
  initial: CalculatorAnswers
  year: number
  onBack: () => void
  onApply: (answers: CalculatorAnswers, targets: { proteinG: number; kcal: number }) => void
}) {
  const t = useTranslations('calculator')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const signed = new Intl.NumberFormat(locale, { signDisplay: 'always' })
  const [answers, setAnswers] = useState(initial)
  const set = (changes: Partial<CalculatorAnswers>) => {
    setAnswers((current) => ({ ...current, ...changes }))
  }
  const estimate = estimateTargets({ ...answers, year })
  return (
    <div className="flex flex-col gap-20">
      <SheetBack label={t('back')} onBack={onBack} />
      <p className="text-label text-ink-2">{t('intro')}</p>
      <ChoiceGroup
        label={t('sex')}
        options={sexSchema.options}
        value={answers.sex}
        onChange={(sex) => {
          set({ sex })
        }}
        optionLabel={(option) => t(`sexOption.${option}`)}
      />
      <NumberField
        label={t('birthYear')}
        value={answers.birthYear}
        inputMode="numeric"
        parse={parseBirthYear}
        onChange={(birthYear) => {
          set({ birthYear })
        }}
        stepBy={1}
        decreaseLabel={t('birthYearDown')}
        increaseLabel={t('birthYearUp')}
      />
      <NumberField
        label={t('heightCm')}
        value={answers.heightCm}
        inputMode="decimal"
        parse={parseHeightCm}
        onChange={(heightCm) => {
          set({ heightCm })
        }}
        stepBy={step.heightCm}
        decreaseLabel={t('heightDown')}
        increaseLabel={t('heightUp')}
      />
      <NumberField
        label={t('weightKg')}
        value={answers.weightKg}
        inputMode="decimal"
        parse={parseWeightKg}
        onChange={(weightKg) => {
          set({ weightKg })
        }}
        stepBy={step.weightKg}
        decreaseLabel={t('weightDown')}
        increaseLabel={t('weightUp')}
      />
      <div role="group" aria-label={t('activity')} className="flex flex-col gap-8">
        <span className="text-label text-ink-3">{t('activity')}</span>
        <div className="flex flex-col rounded-group bg-surface">
          {activityLevelSchema.options.map((level: ActivityLevel) => (
            <Pressable
              key={level}
              aria-pressed={level === answers.activityLevel}
              onClick={() => {
                set({ activityLevel: level })
              }}
              className="flex items-center justify-between gap-12 px-16 py-12 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-ink">{t(`activityOption.${level}.name`)}</span>
                <span className="text-label text-ink-3">{t(`activityOption.${level}.detail`)}</span>
              </span>
              <span
                aria-hidden
                className={`size-20 shrink-0 rounded-full border ${level === answers.activityLevel ? 'border-ink bg-ink' : 'border-line'}`}
              />
            </Pressable>
          ))}
        </div>
      </div>
      <ChoiceGroup
        label={t('phase')}
        options={phaseSchema.options}
        value={answers.phase}
        onChange={(phase: Phase) => {
          set({ phase })
        }}
        optionLabel={(option) => t(`phaseOption.${option}`)}
      />
      <section
        aria-label={t('result')}
        className="flex flex-col gap-8 rounded-group bg-surface p-16"
      >
        <span className="text-label text-ink-3">{t('result')}</span>
        <p className="flex flex-wrap items-baseline gap-x-16 gap-y-4">
          <span className="text-label text-ink-2">
            {t.rich('proteinResult', { protein: whole.format(estimate.proteinG), num: hero })}
          </span>
          <span className="text-label text-ink-2">
            {t.rich('energyResult', { kcal: whole.format(estimate.kcal), num: hero })}
          </span>
        </p>
        <p className="num text-label text-ink-3">
          {estimate.phaseKcal === 0
            ? t('howEnergyBalance', {
                resting: whole.format(estimate.restingKcal),
                factor: estimate.activityFactor,
              })
            : t('howEnergy', {
                resting: whole.format(estimate.restingKcal),
                factor: estimate.activityFactor,
                change: signed.format(estimate.phaseKcal),
              })}
        </p>
        <p className="num text-label text-ink-3">
          {t('howProtein', {
            weight: answers.weightKg,
            perKg: proteinGPerKg[answers.phase],
          })}
        </p>
      </section>
      <Pressable
        onClick={() => {
          onApply(answers, { proteinG: estimate.proteinG, kcal: estimate.kcal })
        }}
        className="rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink"
      >
        {t('apply')}
      </Pressable>
    </div>
  )
}
