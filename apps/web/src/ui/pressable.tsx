'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'

import { pop, press, PRESS_SCALE, reducedFade } from './motion'

type PressableProps = Omit<HTMLMotionProps<'button'>, 'whileTap' | 'transition'>

/**
 * The one way to make something pressable: scales to 0.96 on press and
 * springs back with `pop`. With Reduce Motion it dims instead of scaling.
 */
export function Pressable({ type = 'button', ...props }: PressableProps) {
  const reduced = useReducedMotion() ?? false
  return (
    <motion.button
      type={type}
      whileTap={
        reduced
          ? { opacity: 0.6, transition: reducedFade }
          : { scale: PRESS_SCALE, transition: press }
      }
      transition={reduced ? reducedFade : pop}
      {...props}
    />
  )
}
