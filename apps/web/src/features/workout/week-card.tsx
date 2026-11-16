'use client'

import type { LocalDate, WeekSummary } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { formatWeekday } from '../history/dates'

// This week at a glance: Monday to Sunday with the trained days ticked and
// today outlined, and what the week's finished workouts add up to.
export function WeekCard({ week, today }: { week: WeekSummary; today: LocalDate }) {
  const t = useTranslations('week')
  const tWorkout = useTranslations('workout')
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  return (
    <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-baseline justify-between gap-12">
        <h2 className="text-label text-ink-3">{t('title')}</h2>
        <p className="text-label text-ink-2">
          {t.rich('figures', {
            workouts: week.workouts,
            sets: week.setsDone,
            num: (chunks) => <span className="num">{chunks}</span>,
          })}
          {' · '}
          <span className="num">{number.format(week.volumeKg)}</span> {tWorkout('unit.kg')}
        </p>
      </div>
      <ol className="flex justify-between">
        {week.dates.map((date) => {
          const trained = week.trained.includes(date)
          const day = formatWeekday(date, locale, 'long')
          return (
            <li
              key={date}
              aria-label={trained ? t('trained', { day }) : day}
              aria-current={date === today ? 'date' : undefined}
              className={`flex flex-col items-center gap-4 text-label ${date === today ? 'text-ink' : 'text-ink-3'}`}
            >
              <span
                className={`flex size-28 items-center justify-center rounded-full ${
                  trained ? 'bg-accent' : date === today ? 'border border-ink-2' : 'bg-sunk'
                }`}
              >
                {trained && (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="size-16 fill-none stroke-current text-accent-ink"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 12.5l4 4L18 8" />
                  </svg>
                )}
              </span>
              <span aria-hidden>{formatWeekday(date, locale, 'narrow')}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
