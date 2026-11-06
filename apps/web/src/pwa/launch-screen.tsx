'use client'

import { useAnimate } from 'motion/react'
import { useEffect, useState } from 'react'

import { dissolve, soft } from '@/ui/motion'

import { bar, letterG, markHeight, markSpan, plates, splashMarkShare } from './mark'

const ringRadius = (letterG.inner + letterG.outer) / 2
const ringWidth = letterG.outer - letterG.inner
const openAt = (letterG.open * Math.PI) / 180

/** The mark as SVG, coloured by the theme tokens. */
function Mark() {
  return (
    <svg
      viewBox={`${String(-markSpan / 2)} ${String(-markHeight / 2)} ${String(markSpan)} ${String(markHeight)}`}
      style={{ width: `${String(splashMarkShare * 100)}vw` }}
    >
      <rect
        className="fill-ink-2"
        x={-bar.length / 2}
        y={-bar.thickness / 2}
        width={bar.length}
        height={bar.thickness}
        rx={bar.thickness / 2}
      />
      {plates.flatMap(({ at, width, height, radius, accent }) =>
        [-at, at].map((x) => (
          <rect
            key={x}
            className={accent ? 'fill-accent' : 'fill-ink-2'}
            x={x - width / 2}
            y={-height / 2}
            width={width}
            height={height}
            rx={radius}
          />
        )),
      )}
      <path
        className="stroke-ink"
        fill="none"
        strokeWidth={ringWidth}
        d={`M ${String(ringRadius * Math.cos(openAt))} ${String(-ringRadius * Math.sin(openAt))} A ${String(ringRadius)} ${String(ringRadius)} 0 1 0 ${String(ringRadius)} 0`}
      />
      <rect
        className="fill-ink"
        x={0}
        y={-ringWidth / 2}
        width={letterG.outer}
        height={ringWidth}
      />
    </svg>
  )
}

/**
 * Continues the iOS splash screen into the app: the static HTML opens on the
 * same mark at the same size, holds, lifts (`soft`) and fades away once the
 * page is interactive. Shown only when launched from the home screen
 * (globals.css hides it in a browser tab).
 */
export function LaunchScreen() {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [done, setDone] = useState(false)

  useEffect(() => {
    // In a browser tab globals.css keeps it hidden, so there is nothing to play.
    if (!window.matchMedia('(display-mode: standalone)').matches) return
    const play = async () => {
      // Hold on the splash frame, lift the bar like a rep, then hand over to the page.
      await animate('svg', { y: -24 }, { ...soft, delay: 0.35 })
      // A spring fades fastest at the start, which reads as a cut; the
      // symmetric `dissolve` eases in and out while the mark grows slightly.
      await Promise.all([
        animate('svg', { scale: 1.06 }, dissolve),
        animate(scope.current, { opacity: 0 }, dissolve),
      ])
      setDone(true)
    }
    void play()
  }, [animate, scope])

  if (done) return null
  return (
    <div ref={scope} className="launch-screen" aria-hidden>
      <Mark />
    </div>
  )
}
