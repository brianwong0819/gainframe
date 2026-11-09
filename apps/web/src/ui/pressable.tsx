'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import Link from 'next/link'
import type { ComponentProps } from 'react'

import { pop, press, PRESS_SCALE, reducedFade } from './motion'

/** Scale to 0.96 on press and spring back with `pop`; with Reduce Motion, dim instead. */
function usePressMotion() {
  const reduced = useReducedMotion() ?? false
  return {
    whileTap: reduced
      ? { opacity: 0.6, transition: reducedFade }
      : { scale: PRESS_SCALE, transition: press },
    transition: reduced ? reducedFade : pop,
  }
}

type PressableProps = Omit<HTMLMotionProps<'button'>, 'whileTap' | 'transition'>

/** The one way to make something pressable. */
export function Pressable({ type = 'button', ...props }: PressableProps) {
  return <motion.button type={type} {...usePressMotion()} {...props} />
}

const MotionLink = motion.create(Link)

type PressableLinkProps = Omit<ComponentProps<typeof MotionLink>, 'whileTap' | 'transition'>

/** A link with the same press feel as <Pressable>, for navigation such as tabs. */
export function PressableLink(props: PressableLinkProps) {
  return <MotionLink {...usePressMotion()} {...props} />
}
