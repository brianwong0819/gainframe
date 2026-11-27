'use client'

import type { LocalDate, RangePoint, RateStatus, TrendPoint } from '@gainframe/shared'
import { Area, LinePath } from '@visx/shape'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { niceDomain, Plot, type Scales } from '@/ui/plot'

const HEIGHT = 190

// A local date as a position on the time axis. Noon UTC keeps every day a
// whole day apart whatever the device's time zone.
const at = (date: LocalDate) => Date.parse(`${date}T12:00:00.000Z`)

const endDotClass: Record<RateStatus, string> = {
  onTarget: 'fill-accent',
  tooSlow: 'fill-short',
  tooFast: 'fill-ink',
  offTarget: 'fill-ink',
}

/**
 * The weight chart ("Progress charts" in docs/design-system.md): each
 * weigh-in as a small dot, the 7-day average as the line and the target range
 * as a wedge. Before the average can be shown (`range` is null) only the dots
 * are drawn. `reading` is the index into `points` that the hairline is on.
 */
export function WeightChart({
  points,
  range,
  status,
  from,
  to,
  xLabels,
  yFormat,
  reading,
  onRead,
  draw,
}: {
  points: readonly TrendPoint[]
  range: readonly RangePoint[] | null
  status: RateStatus | null
  from: LocalDate
  to: LocalDate
  xLabels: readonly [string, string, string]
  yFormat: (value: number) => string
  reading: number | null
  onRead: (index: number | null) => void
  draw: boolean
}) {
  const t = useTranslations('progress.weight')
  const showTrend = range !== null
  const values = points.flatMap(({ weightKg, averageKg }) =>
    showTrend ? [weightKg, averageKg] : [weightKg],
  )
  const edges = range?.flatMap(({ lowKg, highKg }) => [lowKg, highKg]) ?? []
  const yDomain = niceDomain(Math.min(...values, ...edges), Math.max(...values, ...edges))
  const start = at(from)
  const end = Math.max(at(to), start + 24 * 60 * 60 * 1000)
  const snaps = points.map(({ localDate }) => at(localDate))
  const read = reading === null ? undefined : points[reading]

  // The series do not change while the chart is read, so they are drawn once
  // per data and size, and a drag re-renders only the hairline and its dot.
  const series = useCallback(
    ({ x, y }: Scales) => {
      const latest = points.at(-1)
      const dotR = points.length > 100 ? 1.5 : showTrend ? 2.5 : 4
      const mark = showTrend ? (latest?.averageKg ?? 0) : (latest?.weightKg ?? 0)
      return (
        <>
          {range !== null && (
            <Area
              data={[...range]}
              x={({ localDate }) => x(at(localDate))}
              y0={({ lowKg }) => y(lowKg)}
              y1={({ highKg }) => y(highKg)}
              className="fill-accent-wash"
            />
          )}
          {points.map(({ localDate, weightKg }) => (
            <circle
              key={localDate}
              cx={x(at(localDate))}
              cy={y(weightKg)}
              r={dotR}
              className="fill-ink-3"
            />
          ))}
          {showTrend && (
            <LinePath
              data={[...points]}
              x={({ localDate }) => x(at(localDate))}
              y={({ averageKg }) => y(averageKg)}
              pathLength={1}
              className={`fill-none stroke-ink ${draw ? 'chart-draw' : ''}`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {latest !== undefined && (
            <circle
              cx={x(at(latest.localDate))}
              cy={y(mark)}
              r={5}
              className={`stroke-surface ${status === null ? 'fill-ink' : endDotClass[status]}`}
              strokeWidth={2}
            />
          )}
        </>
      )
    },
    [points, range, showTrend, status, draw],
  )

  return (
    <Plot
      height={HEIGHT}
      xDomain={[start, end]}
      yDomain={yDomain}
      yFormat={yFormat}
      xLabels={xLabels}
      label={showTrend ? t('chartLabel') : t('dotsLabel', { count: points.length })}
      snaps={snaps}
      reading={reading}
      onRead={onRead}
      overlay={({ x, y }) =>
        read !== undefined && (
          <circle
            cx={x(at(read.localDate))}
            cy={y(showTrend ? read.averageKg : read.weightKg)}
            r={5}
            className="fill-ink stroke-surface"
            strokeWidth={2}
          />
        )
      }
    >
      {series}
    </Plot>
  )
}

// The legend under the chart, for its three series.
export function WeightLegend() {
  const t = useTranslations('progress.weight')
  return (
    <div className="flex flex-wrap gap-16 text-label text-ink-2">
      <span className="flex items-center gap-4">
        <svg width="8" height="8" aria-hidden>
          <circle cx="4" cy="4" r="2.5" className="fill-ink-3" />
        </svg>
        {t('legendWeighIns')}
      </span>
      <span className="flex items-center gap-4">
        <svg width="16" height="8" aria-hidden>
          <path d="M1 4h14" className="stroke-ink" strokeWidth={2} strokeLinecap="round" />
        </svg>
        {t('legendAverage')}
      </span>
      <span className="flex items-center gap-4">
        <svg width="14" height="10" aria-hidden>
          <rect width="14" height="10" rx="2" className="fill-accent-soft" />
        </svg>
        {t('legendRange')}
      </span>
    </div>
  )
}
