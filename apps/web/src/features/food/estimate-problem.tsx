'use client'

import { FOOD_ESTIMATES_PER_DAY } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { PressableLink } from '@/ui/pressable'

import type { EstimateProblem } from './estimate-error'

// When the daily estimate count starts again: the next midnight UTC, the
// server's day for `ai_usage`.
function capResetsAt(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

export const problemActionClass =
  'rounded-full bg-ink px-16 py-12 text-center text-body font-semibold text-bg'

// The problem's title and sentence, its own action (`action`, or the shared
// one for signing in and for the daily cap) and the way to manual entry.
export function ProblemNotice({
  problem,
  action,
}: {
  problem: EstimateProblem
  action: ReactNode
}) {
  const t = useTranslations('estimate')
  const locale = useLocale()
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  const shared =
    problem === 'signIn' ? (
      <PressableLink href="/settings/sign-in" className={problemActionClass}>
        {t('signInAction')}
      </PressableLink>
    ) : problem === 'capped' ? (
      <PressableLink href="/food/add" className={problemActionClass}>
        {t('frequent')}
      </PressableLink>
    ) : null
  return (
    <section className="flex flex-col gap-12" role="alert">
      <h2 className="text-section">{t(`${problem}.title`)}</h2>
      <p className="text-body text-ink-2">
        {problem === 'capped'
          ? t('capped.body', {
              count: FOOD_ESTIMATES_PER_DAY,
              time: timeFormat.format(capResetsAt()),
            })
          : t(`${problem}.body`)}
      </p>
      {shared ?? (problem === 'unavailable' ? null : action)}
      <PressableLink
        href="/food/add"
        className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
      >
        {t('byHand')}
      </PressableLink>
    </section>
  )
}
