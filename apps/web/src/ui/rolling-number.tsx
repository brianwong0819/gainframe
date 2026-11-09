'use client'

import { AnimatePresence, motion, type Variants } from 'motion/react'
import { useState } from 'react'

import { ROLL_STAGGER_S, std } from './motion'

const graphemes = new Intl.Segmenter()

// A rising number rolls up, a falling one down; text that is not a number rolls up.
function direction(previous: string, next: string): 1 | -1 {
  return Number(next) < Number(previous) ? -1 : 1
}

// Functions of the roll direction; AnimatePresence hands the current direction
// to a character that is leaving, so it exits the way the new one enters.
const roll: Variants = {
  enter: (sign: number) => ({ y: `${String(sign * 100)}%`, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (sign: number) => ({ y: `${String(sign * -100)}%`, opacity: 0 }),
}

/**
 * Text whose characters roll into place when it changes: each changed
 * character slides out and its replacement slides in with `std`, one 28 ms
 * after the other. Characters are keyed by their place from the right, so 9 → 10
 * rolls the ones digit and brings in the tens. With Reduce Motion, Motion skips
 * the slide and only the fade remains.
 */
export function RollingNumber({ value }: { value: string }) {
  const [shown, setShown] = useState(value)
  const [sign, setSign] = useState<1 | -1>(1)
  if (value !== shown) {
    setSign(direction(shown, value))
    setShown(value)
  }
  const chars = Array.from(graphemes.segment(value), (part) => part.segment)
  return (
    <span className="inline-flex overflow-hidden">
      {chars.map((char, index) => (
        <span key={chars.length - index} className="inline-block">
          <AnimatePresence initial={false} mode="popLayout" custom={sign}>
            <motion.span
              key={char}
              className="inline-block"
              custom={sign}
              variants={roll}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ ...std, delay: index * ROLL_STAGGER_S }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
