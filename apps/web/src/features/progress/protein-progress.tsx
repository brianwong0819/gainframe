'use client'

import { foodCheck, type LocalDate, proteinMet, toLocalDate } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import type { DayIntake } from '@/db/food'
import { formatDay, formatShortDay } from '@/features/history/dates'
import { deviceTimeZone } from '@/i18n/time-zone'
import { PressableLink } from '@/ui/pressable'
import { SegmentedControl } from '@/ui/segmented-control'
import { Verdict } from '@/ui/verdict'

import { DayBars } from './day-bars'
import { EnergyVerdict, ProteinVerdict } from './intake-verdict'
import { useIntake } from './use-intake'

const ranges = ['2w', '4w'] as const
type Range = (typeof ranges)[number]
const rangeDays: Record<Range, number> = { '2w': 14, '4w': 28 }
const HEIGHT = 120

/**
 * The protein page (designed with M4-07, "Progress charts" in
 * docs/design-system.md): a range control, then protein and energy, each a
 * card with its figure, a verdict line and one column per day against the
 * target, and the days as a list. Tapping a column selects that day in both
 * cards; the selection stays until the column is tapped again. Today is left
 * out because it is not over.
 */
export function ProteinProgress() {
  const t = useTranslations('progress.protein')
  const locale = useLocale()
  const [today] = useState<LocalDate>(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const [range, setRange] = useState<Range>('2w')
  const [selected, setSelected] = useState<number | null>(null)
  const intake = useIntake(today, rangeDays[range])
  if (intake === undefined) return null
  const { days, targets, phase } = intake

  if (targets === null) {
    return (
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <p className="text-body text-ink-2">{t('noTargets')}</p>
        <PressableLink
          href="/food"
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {t('setTargets')}
        </PressableLink>
      </section>
    )
  }

  const check = foodCheck(days, targets)
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const day = selected === null ? undefined : days[selected]
  const met = (each: DayIntake) => proteinMet(each, targets.proteinG)
  const barLabel = (each: DayIntake) =>
    each.meals === 0
      ? t('barNone', { date: formatDay(each.localDate, locale) })
      : t('barLabel', {
          date: formatDay(each.localDate, locale),
          protein: whole.format(each.proteinG),
          kcal: whole.format(each.kcal),
        })
  const span = t('span', {
    from: formatShortDay(days[0]?.localDate ?? today, locale),
    to: formatShortDay(days.at(-1)?.localDate ?? today, locale),
  })
  const heading = day === undefined ? span : formatDay(day.localDate, locale)

  let proteinLine
  let energyLine
  if (day === undefined) {
    proteinLine = <ProteinVerdict check={check} targetG={targets.proteinG} />
    energyLine = <EnergyVerdict check={check} targetKcal={targets.kcal} phase={phase} />
  } else if (day.meals === 0) {
    proteinLine = <p className="text-label text-ink-2">{t('dayNone')}</p>
    energyLine = proteinLine
  } else {
    proteinLine = met(day) ? (
      <Verdict tone="ok" word={t('dayMet')}>
        {t('target', { grams: whole.format(targets.proteinG) })}
      </Verdict>
    ) : (
      <Verdict
        tone="plain"
        word={t('dayShort', { grams: whole.format(targets.proteinG - day.proteinG) })}
      >
        {t('target', { grams: whole.format(targets.proteinG) })}
      </Verdict>
    )
    energyLine = (
      <EnergyVerdict check={foodCheck([day], targets)} targetKcal={targets.kcal} phase={phase} />
    )
  }

  const bars = {
    days,
    height: HEIGHT,
    selected,
    onSelect: setSelected,
    barLabel,
  }

  return (
    <>
      <SegmentedControl
        label={t('rangeLabel')}
        options={ranges}
        value={range}
        onChange={(next) => {
          setRange(next)
          setSelected(null)
        }}
        optionLabel={(option) => t(`range.${option}`)}
      />

      <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">
          {t('proteinHeading')} · {heading}
        </h2>
        <p className="flex items-baseline gap-4 pt-4">
          {day === undefined ? (
            <>
              <span className="num text-title">{check.proteinMetDays.toString()}</span>
              <span className="text-label text-ink-2">
                {t('metOf', { logged: check.loggedDays })}
              </span>
            </>
          ) : (
            <>
              <span className="num text-title">{whole.format(day.proteinG)}</span>
              <span className="text-label text-ink-2">g</span>
            </>
          )}
        </p>
        {proteinLine}
        <div className="pt-8">
          <DayBars
            {...bars}
            value={({ proteinG }) => proteinG}
            target={targets.proteinG}
            tone={(each) => (met(each) ? 'met' : 'plain')}
            label={t('chartLabel', { met: check.proteinMetDays, logged: check.loggedDays })}
          />
        </div>
        <p className="pt-8 text-label text-ink-2">{t('proteinNote')}</p>
      </section>

      <section className="flex flex-col gap-4 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">
          {t('energyHeading')} · {heading}
        </h2>
        <p className="flex items-baseline gap-4 pt-4">
          <span className="num text-title">
            {day === undefined
              ? check.loggedDays === 0
                ? '–'
                : whole.format(targets.kcal + check.kcalVsTarget)
              : whole.format(day.kcal)}
          </span>
          <span className="text-label text-ink-2">
            {day === undefined ? t('kcalPerDay') : 'kcal'}
          </span>
        </p>
        {energyLine}
        <div className="pt-8">
          <DayBars
            {...bars}
            value={({ kcal }) => kcal}
            target={targets.kcal}
            tone={() => 'plain'}
            label={t('energyChartLabel')}
          />
        </div>
      </section>

      <section className="rounded-group bg-surface px-16 pt-16 pb-4">
        <div className="flex justify-between gap-12 pb-8 text-label text-ink-2">
          <h2>{t('daysHeading')}</h2>
          <span>{t('daysColumns')}</span>
        </div>
        <ul>
          {days.toReversed().map((each) => (
            <li
              key={each.localDate}
              className="flex items-center justify-between gap-12 border-t border-line py-12"
            >
              <span className="flex items-center gap-8 text-body">
                {formatDay(each.localDate, locale)}
                {met(each) && (
                  <span className="rounded-full bg-accent-wash px-8 text-label text-accent">
                    {t('metTag')}
                  </span>
                )}
              </span>
              {each.meals === 0 ? (
                <span className="text-label text-ink-3">{t('notLogged')}</span>
              ) : (
                <span className="num flex items-baseline gap-12 text-label text-ink-2">
                  <span>
                    <span className="text-body font-semibold text-ink">
                      {whole.format(each.proteinG)}
                    </span>{' '}
                    g
                  </span>
                  <span>{whole.format(each.kcal)} kcal</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
