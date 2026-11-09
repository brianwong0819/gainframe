'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useId, useRef } from 'react'

import { fade, reducedFade, std } from './motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * A bottom sheet on a native modal <dialog>, which brings focus trapping, the
 * Escape key and an inert page behind it. The panel rises with `std` over a
 * fading scrim; with Reduce Motion both only fade. The dialog closes after the
 * exit animation, so the panel is seen leaving.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion() ?? false

  useEffect(() => {
    const element = dialog.current
    if (open && element && !element.open) element.showModal()
  }, [open])

  const hidden = reduced ? { opacity: 0 } : { y: '100%' }
  const shown = reduced ? { opacity: 1 } : { y: 0 }

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? reducedFade : fade}
            onClick={onClose}
          />
        )}
        {open && (
          <motion.div
            key="panel"
            className="sheet-panel"
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={reduced ? reducedFade : std}
          >
            <span className="sheet-grab" aria-hidden />
            <h2 id={titleId} className="text-section">
              {title}
            </h2>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}
