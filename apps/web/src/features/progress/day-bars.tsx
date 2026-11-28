'use client'

import type { DayIntake } from '@/db/food'
import { useWidth } from '@/ui/plot'
import { Pressable } from '@/ui/pressable'

export const BAR_RADIUS = 4
const MAX_BAR_W = 16

export type BarTone = 'met' | 'plain'

const toneClass: Record<BarTone, string> = { met: 'fill-accent', plain: 'fill-ink-3' }

// A bar with rounded top corners, from the baseline up to `top`.
export function barPath(x: number, width: number, top: number, base: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, Math.max(0, base - top))
  return `M${String(x)},${String(base)}V${String(top + r)}Q${String(x)},${String(top)} ${String(x + r)},${String(top)}H${String(x + width - r)}Q${String(x + width)},${String(top)} ${String(x + width)},${String(top + r)}V${String(base)}Z`
}

/**
 * One column per day against a target line ("Progress charts" in
 * docs/design-system.md). A day without a meal has no column. With
 * `onSelect`, each column is a button: a tap selects the day and the
 * selection stays; tapping it again clears it. Without, the drawing is
 * decoration inside a link.
 */
export function DayBars({
  days,
  value,
  target,
  tone,
  height,
  label,
  selected = null,
  onSelect,
  barLabel,
}: {
  days: readonly DayIntake[]
  value: (day: DayIntake) => number
  target: number
  tone: (day: DayIntake) => BarTone
  height: number
  label: string
  selected?: number | null
  onSelect?: (index: number | null) => void
  barLabel?: (day: DayIntake) => string
}) {
  const [box, width] = useWidth()
  const max = Math.max(target * 1.2, ...days.map(value), 1)
  const pitch = width / Math.max(1, days.length)
  const barW = Math.max(2, Math.min(MAX_BAR_W, pitch - 4))
  const y = (shown: number) => height - (shown / max) * (height - BAR_RADIUS)

  return (
    <div ref={box} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          <line x1={0} x2={width} y1={height} y2={height} className="stroke-line" />
          {days.map((day, index) =>
            day.meals > 0 && value(day) > 0 ? (
              <path
                key={day.localDate}
                d={barPath(index * pitch + (pitch - barW) / 2, barW, y(value(day)), height)}
                className={index === selected ? 'fill-ink' : toneClass[tone(day)]}
              />
            ) : null,
          )}
          <line
            x1={0}
            x2={width}
            y1={y(target)}
            y2={y(target)}
            className="stroke-ink-2"
            strokeWidth={1}
          />
        </svg>
      )}
      {onSelect !== undefined && (
        <div className="absolute inset-0 flex touch-pan-y">
          {days.map((day, index) => (
            <Pressable
              key={day.localDate}
              aria-pressed={selected === index}
              aria-label={barLabel?.(day)}
              onClick={() => {
                onSelect(selected === index ? null : index)
              }}
              className="h-full flex-1"
            />
          ))}
        </div>
      )}
    </div>
  )
}
