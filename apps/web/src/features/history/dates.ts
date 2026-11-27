import type { LocalDate } from '@gainframe/shared'

// A stored local date ("2026-11-14") read as that calendar day. Formatting in
// UTC keeps the device's time zone from moving it to the day before.
const asDay = (date: LocalDate) => new Date(`${date}T00:00:00Z`)

// "Sat, Nov 14" in English; month, day and weekday in Chinese.
export function formatDay(date: LocalDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(asDay(date))
}

// "November 2026", the heading of a month in history.
export function formatMonth(date: LocalDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(asDay(date))
}

// When a workout started, on the device's clock ("18:30").
export function formatTime(instant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(instant),
  )
}

// A weekday for a column of days: one letter when narrow ("M"), else in full.
export function formatWeekday(date: LocalDate, locale: string, width: 'narrow' | 'long'): string {
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(asDay(date))
}

// "Nov 17": month and day, for a chart axis or a span of days.
export function formatShortDay(date: LocalDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(asDay(date))
}
