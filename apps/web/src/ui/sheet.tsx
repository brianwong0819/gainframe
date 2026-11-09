'use client'

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useDragControls,
  useReducedMotion,
} from 'motion/react'
import { type ReactNode, useEffect, useId, useRef } from 'react'

import { fade, reducedFade, std } from './motion'
import { Pressable } from './pressable'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
}

// A downward drag past this distance (px) or speed (px/s) closes the sheet.
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 600

/**
 * A bottom sheet on a native modal <dialog>, which brings focus trapping, the
 * Escape key and an inert page behind it. The panel rises with `std` over a
 * fading scrim; with Reduce Motion both only fade. The dialog closes after the
 * exit animation, so the panel is seen leaving. It closes with the close
 * button, a tap on the scrim, Escape, or a downward drag of its header. The
 * panel itself takes focus on opening, so a form field does not raise the
 * keyboard until the user taps it. That focus must not scroll: the panel
 * still sits below the screen at that moment, and WebKit would scroll it into
 * view for one frame before the entry animation starts.
 *
 * The entry animation starts only after `showModal()`. Children mount while
 * the dialog is still closed (display: none), and WebKit drew the first frame
 * of an animation started there in the wrong place (L-023).
 */
export function Sheet({ open, onClose, title, closeLabel, children }: SheetProps) {
  const drag = useDragControls()
  const dialog = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion() ?? false
  const entry = useAnimationControls()

  useEffect(() => {
    const element = dialog.current
    if (open && element && !element.open) {
      element.showModal()
      panel.current?.focus({ preventScroll: true })
      void entry.start('shown')
    }
  }, [open, entry])

  const scrim = {
    hidden: { opacity: 0, transition: reduced ? reducedFade : fade },
    shown: { opacity: 1, transition: reduced ? reducedFade : fade },
  }
  const sheet = {
    hidden: reduced ? { opacity: 0, transition: reducedFade } : { y: '100%', transition: std },
    shown: reduced ? { opacity: 1, transition: reducedFade } : { y: 0, transition: std },
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="sheet-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <AnimatePresence onExitComplete={() => dialog.current?.close()}>
        {open && (
          <motion.div
            key="scrim"
            className="sheet-scrim"
            variants={scrim}
            initial="hidden"
            animate={entry}
            exit="hidden"
            onClick={onClose}
          />
        )}
        {open && (
          <motion.div
            key="panel"
            className="sheet-panel"
            variants={sheet}
            initial="hidden"
            animate={entry}
            exit="hidden"
            ref={panel}
            tabIndex={-1}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) onClose()
            }}
          >
            <div
              className="sheet-header"
              onPointerDown={(event) => {
                drag.start(event)
              }}
            >
              <span className="sheet-grab" aria-hidden />
              <div className="flex items-start justify-between gap-12">
                <h2 id={titleId} className="text-section">
                  {title}
                </h2>
                <Pressable
                  aria-label={closeLabel}
                  onClick={onClose}
                  className="-mr-8 shrink-0 rounded-full bg-sunk p-12 text-ink-2"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="size-20 fill-none stroke-current"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </Pressable>
              </div>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}
