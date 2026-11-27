'use client'

import { type BodyMetric, domainConfig, type LocalDate } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { saveWeighIn } from '@/db/body-metrics'
import { db, repositories } from '@/db/client'
import { formatDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { Stepper } from '@/ui/stepper'

import { parseBodyFat, parseBodyWeight, parseMuscleMass, stepTenth } from './weigh-in'

const { step, scanStart } = domainConfig.bodyWeight

interface Scan {
  bodyFatPct: number
  skeletalMuscleKg: number
}

// The weigh-in sheet ("Progress charts" in docs/design-system.md): one stepper
// prefilled with the last weigh-in, optional scan figures behind a row, and a
// save button that names the value. Mounted afresh each time it opens, so the
// prefill is the latest weigh-in.
export function WeighInSheet({
  open,
  onClose,
  today,
  last,
  lastScan,
}: {
  open: boolean
  onClose: () => void
  today: LocalDate
  last: BodyMetric | undefined
  lastScan: Scan | null
}) {
  const t = useTranslations('weighIn')
  const locale = useLocale()
  const tenth = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const [weightKg, setWeightKg] = useState(last?.weightKg ?? domainConfig.estimate.start.weightKg)
  const [scan, setScan] = useState<Scan | null>(null)
  const [saving, setSaving] = useState(false)
  const weight = tenth.format(weightKg)

  const openScan = () => {
    setScan(
      lastScan ?? {
        bodyFatPct: scanStart.bodyFatPct,
        skeletalMuscleKg: Math.round(weightKg * scanStart.skeletalMuscleShare * 10) / 10,
      },
    )
  }
  const save = () => {
    setSaving(true)
    void saveWeighIn(db, repositories, {
      weightKg,
      bodyFatPct: scan?.bodyFatPct ?? null,
      skeletalMuscleKg: scan?.skeletalMuscleKg ?? null,
      measuredAt: new Date().toISOString(),
      timeZone: deviceTimeZone(),
    }).then(onClose)
  }

  let hint = t('typeHint')
  if (last?.localDate === today) hint = t('todayHint', { weight: tenth.format(last.weightKg) })
  else if (last !== undefined) {
    hint = t('lastHint', {
      weight: tenth.format(last.weightKg),
      date: formatDay(last.localDate, locale),
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={t('close')}>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-8">
          <span className="text-label text-ink-3">
            {t('when', { date: formatDay(today, locale) })}
          </span>
          <Stepper
            value={weight}
            editValue={String(weightKg)}
            inputMode="decimal"
            label={t('weight')}
            unit="kg"
            onEnter={(text) => {
              const typed = parseBodyWeight(text)
              if (typed !== null) setWeightKg(Math.round(typed * 10) / 10)
            }}
            canDecrease={parseBodyWeight(String(stepTenth(weightKg, step.weightKg, -1))) !== null}
            decreaseLabel={t('weightDown')}
            increaseLabel={t('weightUp')}
            onStep={(direction) => {
              const next = stepTenth(weightKg, step.weightKg, direction)
              if (parseBodyWeight(String(next)) !== null) setWeightKg(next)
            }}
          />
          <p className="text-label text-ink-2">{hint}</p>
        </div>
        {scan === null ? (
          <Pressable
            onClick={openScan}
            className="flex items-center justify-between gap-12 rounded-group bg-surface px-16 py-12 text-left"
          >
            <span className="text-body text-ink">{t('addScan')}</span>
            <span className="flex items-center gap-8 text-label text-ink-3">
              {t('optional')}
              <Chevron direction="right" />
            </span>
          </Pressable>
        ) : (
          <div className="flex flex-col gap-12 border-t border-line pt-16">
            <div className="flex items-center justify-between gap-12">
              <span className="text-label text-ink-3">{t('scanHeading')}</span>
              <Pressable
                onClick={() => {
                  setScan(null)
                }}
                className="-my-8 py-8 text-label text-ink-2"
              >
                {t('removeScan')}
              </Pressable>
            </div>
            <ScanStepper
              label={t('bodyFat')}
              unit="%"
              value={scan.bodyFatPct}
              stepBy={step.bodyFatPct}
              parse={parseBodyFat}
              downLabel={t('bodyFatDown')}
              upLabel={t('bodyFatUp')}
              onChange={(bodyFatPct) => {
                setScan({ ...scan, bodyFatPct })
              }}
            />
            <ScanStepper
              label={t('muscle')}
              unit="kg"
              value={scan.skeletalMuscleKg}
              stepBy={step.skeletalMuscleKg}
              parse={parseMuscleMass}
              downLabel={t('muscleDown')}
              upLabel={t('muscleUp')}
              onChange={(skeletalMuscleKg) => {
                setScan({ ...scan, skeletalMuscleKg })
              }}
            />
            <p className="text-label text-ink-3">{t('scanNote')}</p>
          </div>
        )}
        <p className="text-label text-ink-3">{t('tip')}</p>
        <Pressable
          disabled={saving}
          onClick={save}
          className="rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink"
        >
          {t('save', { weight })}
        </Pressable>
      </div>
    </Sheet>
  )
}

function ScanStepper({
  label,
  unit,
  value,
  stepBy,
  parse,
  downLabel,
  upLabel,
  onChange,
}: {
  label: string
  unit: string
  value: number
  stepBy: number
  parse: (text: string) => number | null
  downLabel: string
  upLabel: string
  onChange: (value: number) => void
}) {
  const locale = useLocale()
  const tenth = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const next = (direction: -1 | 1) => parse(String(stepTenth(value, stepBy, direction)))
  return (
    <div className="flex flex-col gap-8">
      <span className="text-label text-ink-3">{label}</span>
      <Stepper
        value={tenth.format(value)}
        editValue={String(value)}
        inputMode="decimal"
        label={label}
        unit={unit}
        onEnter={(text) => {
          const typed = parse(text)
          if (typed !== null) onChange(Math.round(typed * 10) / 10)
        }}
        canDecrease={next(-1) !== null}
        decreaseLabel={downLabel}
        increaseLabel={upLabel}
        onStep={(direction) => {
          const stepped = next(direction)
          if (stepped !== null) onChange(stepped)
        }}
      />
    </div>
  )
}
