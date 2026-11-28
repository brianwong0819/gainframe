'use client'

import { motion, useReducedMotion } from 'motion/react'
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
// must offer the same action. The action rides just past the row's right edge,
// so it never sits beneath the row: dark groups are translucent, and the row
// paints no ground of its own (its content does).
export function SwipeRow({ open, onOpenChange, actionLabel, onAction, children }: SwipeRowProps) {
  const reduced = useReducedMotion() ?? false
  const actionRef = useRef<HTMLButtonElement>(null)
  const dragged = useRef(false)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    setWidth(actionRef.current?.offsetWidth ?? 0)
  }, [actionLabel])

  return (
    <div className="overflow-hidden rounded-ctl">
      <motion.div
        drag="x"
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
          const target = event.target
          const onActionButton =
            target instanceof Node && (actionRef.current?.contains(target) ?? false)
          if (!dragged.current && (!open || onActionButton)) return
          event.stopPropagation()
          if (!dragged.current) onOpenChange(false)
        }}
        className="relative"
      >
        {children}
        <button
          ref={actionRef}
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={onAction}
          className="absolute inset-y-0 left-full bg-ink px-16 whitespace-nowrap text-label font-semibold text-bg"
        >
          {actionLabel}
        </button>
      </motion.div>
    </div>
  )
}
