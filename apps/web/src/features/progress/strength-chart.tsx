'use client'

import type { LocalDate, StrengthPoint } from '@gainframe/shared'
import { LinePath } from '@visx/shape'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { niceDomain, Plot, type Scales } from '@/ui/plot'

const HEIGHT = 190
const DAY_MS = 24 * 60 * 60 * 1000

// A local date as a position on the time axis; noon UTC keeps every day a
// whole day apart whatever the device's time zone.
export const at = (date: LocalDate) => Date.parse(`${date}T12:00:00.000Z`)

/**
 * The strength chart ("Progress charts" in docs/design-system.md): each
 * workout's best set as one point by date, joined by the line; a record is a
 * filled accent point, other workouts are hollow. `value` converts a point to
 * the shown unit; `reading` is the index into `points` the hairline is on.
 */
export function StrengthChart({
  points,
  value,
  from,
  to,
  xLabels,
  yFormat,
  reading,
  onRead,
  draw,
}: {
  points: readonly StrengthPoint[]
  value: (point: StrengthPoint) => number
  from: LocalDate
  to: LocalDate
  xLabels: readonly [string, string, string]
  yFormat: (value: number) => string
  reading: number | null
  onRead: (index: number | null) => void
  draw: boolean
}) {
  const t = useTranslations('progress.strength')
  const values = points.map(value)
  const yDomain = niceDomain(Math.min(...values), Math.max(...values))
  const start = at(from)
  const end = Math.max(at(to), start + DAY_MS)
  const snaps = points.map(({ localDate }) => at(localDate))
  const read = reading === null ? undefined : points[reading]

  // Drawn once per data and size; a drag re-renders only the hairline and its
  // ring (L-056).
  const series = useCallback(
    ({ x, y }: Scales) => (
      <>
        <LinePath
          data={[...points]}
          x={({ localDate }) => x(at(localDate))}
          y={(point) => y(value(point))}
          pathLength={1}
          className={`fill-none stroke-ink ${draw ? 'chart-draw' : ''}`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle
            key={point.workoutId}
            cx={x(at(point.localDate))}
            cy={y(value(point))}
            r={point.record ? 4.5 : 3.5}
            className={point.record ? 'fill-accent stroke-surface' : 'fill-surface stroke-ink-2'}
            strokeWidth={point.record ? 2 : 1.5}
          />
        ))}
      </>
    ),
    [points, value, draw],
  )

  return (
    <Plot
      height={HEIGHT}
      xDomain={[start, end]}
      yDomain={yDomain}
      yFormat={yFormat}
      xLabels={xLabels}
      label={t('chartLabel')}
      snaps={snaps}
      reading={reading}
      onRead={onRead}
      overlay={({ x, y }) =>
        read !== undefined && (
          <circle
            cx={x(at(read.localDate))}
            cy={y(value(read))}
            r={7}
            className="fill-none stroke-ink"
            strokeWidth={2}
          />
        )
      }
    >
      {series}
    </Plot>
  )
}

// The legend under the chart: records and other workouts.
export function StrengthLegend() {
  const t = useTranslations('progress.strength')
  return (
    <div className="flex flex-wrap gap-16 text-label text-ink-2">
      <span className="flex items-center gap-4">
        <svg width="10" height="10" aria-hidden>
          <circle cx="5" cy="5" r="4" className="fill-accent" />
        </svg>
        {t('legendRecord')}
      </span>
      <span className="flex items-center gap-4">
        <svg width="10" height="10" aria-hidden>
          <circle cx="5" cy="5" r="3.2" className="fill-surface stroke-ink-2" strokeWidth={1.5} />
        </svg>
        {t('legendOther')}
      </span>
    </div>
  )
}
