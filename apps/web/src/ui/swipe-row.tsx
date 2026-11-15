'use client'

import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'

import { reducedFade, std } from './motion'

// A flick faster than this (px/s) opens the row whatever its position.
const flickSpeed = 500

interface SwipeRowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

// A list row that slides left to reveal one action, as in iOS lists. It snaps
// open past half the action's width or on a quick flick, and a tap on an open
// row closes it instead of activating it. The swipe is a shortcut for touch:
// the action stays hidden from assistive technology, so whatever the row opens
// must offer the same action.
export function SwipeRow({ open, onOpenChange, actionLabel, onAction, children }: SwipeRowProps) {
  const reduced = useReducedMotion() ?? false
  const actionRef = useRef<HTMLButtonElement>(null)
  const dragged = useRef(false)
  const [width, setWidth] = useState(0)
  // The action shows only while the row is moved, so no sliver of it shows
  // through the row's rounded corners at rest.
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [-1, 0], [1, 0])
  useLayoutEffect(() => {
    setWidth(actionRef.current?.offsetWidth ?? 0)
  }, [actionLabel])

  return (
    <div className="relative overflow-hidden rounded-ctl">
      <motion.button
        ref={actionRef}
        style={{ opacity: actionOpacity }}
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onAction}
        className="absolute inset-y-0 right-0 bg-ink px-16 text-label font-semibold text-bg"
      >
        {actionLabel}
      </motion.button>
      <motion.div
        drag="x"
        style={{ x }}
        dragDirectionLock
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={0.1}
        animate={{ x: open ? -width : 0 }}
        transition={reduced ? reducedFade : std}
        onPointerDownCapture={() => {
          dragged.current = false
        }}
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={(_, { offset, velocity }) => {
          const x = (open ? -width : 0) + offset.x
          onOpenChange(x < -width / 2 || velocity.x < -flickSpeed)
        }}
        onClickCapture={(event) => {
          if (!dragged.current && !open) return
          event.stopPropagation()
          if (!dragged.current) onOpenChange(false)
        }}
        className="relative bg-surface"
      >
        {children}
      </motion.div>
    </div>
  )
}
