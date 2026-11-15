'use client'

import { useTranslations } from 'next-intl'

// A workout's length as the summary and history show it: "< 1 min" below a
// minute, minutes below an hour, then hours and minutes.
export function useDurationText(): (seconds: number) => string {
  const t = useTranslations('summary')
  return (seconds) => {
    if (seconds < 60) return t('underMinute')
    const minutes = Math.round(seconds / 60)
    return minutes >= 60
      ? t('hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : t('minutes', { minutes })
  }
}
