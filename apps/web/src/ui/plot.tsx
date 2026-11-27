'use client'

import { scaleLinear } from '@visx/scale'
import { type PointerEvent, type ReactNode, useCallback, useMemo, useState } from 'react'

type Scale = ReturnType<typeof scaleLinear<number>>
export interface Scales {
  x: Scale
  y: Scale
}

// Room at the right of the plot for the grid values, and above and below the
// outermost grid lines for a dot or the line's stroke.
const AXIS_W = 36
const INSET = 8

// A domain that starts and ends on a round value, spanning an even number of
// steps so the middle grid line is round too ("62.0", not "62.25").
export function niceDomain(min: number, max: number): [number, number] {
  const span = max - min
  const step = span > 4 ? 2 : span > 2 ? 1 : 0.5
  const low = Math.floor(min / step) * step
  let steps = Math.max(2, Math.ceil((max - low) / step))
  if (steps % 2 === 1) steps += 1
  return [low, low + steps * step]
}

// The index of the snap position nearest to `value`; `positions` is ascending.
export function nearestIndex(positions: readonly number[], value: number): number {
  return positions.reduce(
    (best, position, index) =>
      Math.abs(position - value) < Math.abs((positions[best] ?? Infinity) - value) ? index : best,
    0,
  )
}

// The width of an element, measured once it is on screen and again when it
// changes; 0 until then, so a chart draws nothing during prerendering.
// A callback ref, so an element that appears after the first render (once
// its data has loaded) is measured too.
export function useWidth() {
  const [width, setWidth] = useState(0)
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [ref, width] as const
}

/**
 * The frame every chart draws in ("Progress charts" in docs/design-system.md):
 * three hairline grid lines with their values at the right, three dates
 * beneath, and reading by touch. A horizontal drag or a tap moves a hairline
 * that snaps to the nearest of `snaps` (x values) and reports its index
 * through `onRead`; lifting the finger reports null. `touch-action: pan-y`
 * leaves vertical scrolling to the page. The plot measures its own width, so
 * it draws nothing until it is on screen.
 */
export function Plot({
  height,
  xDomain,
  yDomain,
  yFormat,
  xLabels,
  label,
  snaps,
  reading,
  onRead,
  children,
  overlay,
}: {
  height: number
  xDomain: [number, number]
  yDomain: [number, number]
  yFormat: (value: number) => string
  xLabels: readonly [string, string, string]
  label: string
  snaps: readonly number[]
  reading: number | null
  onRead: (index: number | null) => void
  children: (scales: Scales) => ReactNode
  overlay: (scales: Scales) => ReactNode
}) {
  const [box, width] = useWidth()

  const plotW = Math.max(0, width - AXIS_W)
  const [low, high] = yDomain
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const scales = useMemo(
    () => ({
      x: scaleLinear<number>({ domain: [x0, x1], range: [INSET / 2, plotW - INSET / 2] }),
      y: scaleLinear<number>({ domain: [y0, y1], range: [height - INSET, INSET] }),
    }),
    [x0, x1, y0, y1, plotW, height],
  )
  const { x, y } = scales
  // `children` draws the series; the caller keeps it stable while the chart is
  // read, so a drag redraws only the hairline and `overlay`.
  const drawn = useMemo(() => children(scales), [children, scales])
  const grid = [high, (low + high) / 2, low]

  const read = (event: PointerEvent<HTMLDivElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left
    const index = nearestIndex(snaps, x.invert(event.clientX - left))
    if (index !== reading) onRead(index)
  }
  const stop = () => {
    onRead(null)
  }
  const readX = reading === null ? undefined : snaps[reading]

  return (
    <div>
      <div ref={box} className="relative" style={{ height }}>
        {width > 0 && (
          <>
            <svg width={plotW} height={height} role="img" aria-label={label} className="block">
              {grid.map((value) => (
                <line
                  key={value}
                  x1={0}
                  x2={plotW}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-line"
                  strokeWidth={1}
                />
              ))}
              {drawn}
            </svg>
            {/* The reading draws on its own compositing layer, so moving it
                repaints only the hairline and its dot, not the series
                beneath (WebKit repainted the whole chart on each read). */}
            <svg
              aria-hidden
              width={plotW}
              height={height}
              className="pointer-events-none absolute top-0 left-0 block will-change-transform"
            >
              {readX !== undefined && (
                <line
                  x1={x(readX)}
                  x2={x(readX)}
                  y1={INSET}
                  y2={height - INSET}
                  className="stroke-ink-2"
                  strokeWidth={1}
                />
              )}
              {overlay(scales)}
            </svg>
            <div
              aria-hidden
              className="num absolute top-0 right-0 text-right text-caption text-ink-2"
              style={{ width: AXIS_W, height }}
            >
              {grid.map((value) => (
                <span
                  key={value}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: y(value) }}
                >
                  {yFormat(value)}
                </span>
              ))}
            </div>
            <div
              aria-hidden
              data-chart-touch
              className="absolute inset-y-0 left-0 touch-pan-y"
              style={{ width: plotW }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                read(event)
              }}
              onPointerMove={(event) => {
                if (event.buttons !== 0) read(event)
              }}
              onPointerUp={stop}
              onPointerCancel={stop}
              onLostPointerCapture={stop}
            />
          </>
        )}
      </div>
      <div
        aria-hidden
        className="flex justify-between pt-4 text-caption text-ink-2"
        style={{ paddingRight: AXIS_W }}
      >
        {xLabels.map((text, index) => (
          <span key={index}>{text}</span>
        ))}
      </div>
    </div>
  )
}
