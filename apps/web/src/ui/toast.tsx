'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import { reducedFade, std } from './motion'
import { Pressable } from './pressable'

// How long a toast stays when nothing is tapped: long enough to read one line
// and reach Undo with the thumb.
const TOAST_MS = 5000

/**
 * A one-line confirmation with one action (Undo), docked above the tab bar.
 * It rises with `std` (a fade under Reduce Motion) and leaves on its own after
 * a few seconds; `id` changes for each new message, which restarts the wait.
 */
export function Toast({
  toast,
  actionLabel,
  onAction,
  onDone,
}: {
  toast: { id: string; message: string } | null
  actionLabel: string
  onAction: () => void
  onDone: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const id = toast?.id
  useEffect(() => {
    if (id === undefined) return
    const timer = setTimeout(onDone, TOAST_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [id, onDone])
  return (
    <div className="screen-dock" aria-live="polite">
      <AnimatePresence>
        {toast !== null && (
          <motion.div
            key={toast.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduced ? reducedFade : std}
            className="flex items-center justify-between gap-12 rounded-full bg-ink py-4 pr-4 pl-16 text-bg"
          >
            <span className="min-w-0 truncate text-label">{toast.message}</span>
            <Pressable
              onClick={onAction}
              className="shrink-0 rounded-full px-16 py-12 text-label font-semibold text-bg"
            >
              {actionLabel}
            </Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
