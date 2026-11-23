'use client'

import { type ApiError, FOOD_ESTIMATES_PER_DAY, type PhotoIssue } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { ApiRequestError, NotSignedInError } from '@/api/client'
import { PressableLink } from '@/ui/pressable'

// Why there is no estimate to confirm. The photo issues come from the model;
// the rest from the request ("States" in docs/design-system.md). `no_text_food`
// is a description that names no food.
export type EstimateProblem =
  | 'signIn'
  | 'notEnabled'
  | 'offline'
  | 'unavailable'
  | 'timeout'
  | 'failed'
  | 'refused'
  | 'capped'
  | 'no_text_food'
  | PhotoIssue

// The API's AI error codes as problems; any other answer is a failed estimate.
const API_PROBLEMS: Partial<Record<ApiError['error']['code'], EstimateProblem>> = {
  ai_not_enabled: 'notEnabled',
  ai_capped: 'capped',
  ai_unavailable: 'unavailable',
  ai_timeout: 'timeout',
  ai_refused: 'refused',
}

export function problemOf(error: unknown): EstimateProblem {
  if (error instanceof NotSignedInError) return 'signIn'
  if (error instanceof ApiRequestError) {
    return (error.code === null ? undefined : API_PROBLEMS[error.code]) ?? 'failed'
  }
  return navigator.onLine ? 'failed' : 'offline'
}

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
