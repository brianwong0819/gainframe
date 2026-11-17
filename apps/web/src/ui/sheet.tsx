'use client'

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useId, useRef } from 'react'

import { fade, reducedFade, std } from './motion'
import { Pressable } from './pressable'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
  // Keeps the panel at its full height whatever its content, for a list that
  // a search shortens.
  fullHeight?: boolean
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
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  fullHeight = false,
}: SheetProps) {
  const drag = useDragControls()
  const dialog = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const reduced = useReducedMotion() ?? false

  useEffect(() => {
    const element = dialog.current
    if (open && element && !element.open) {
      element.showModal()
      panel.current?.focus({ preventScroll: true })
    }
  }, [open])

  // iOS shows the keyboard over the page without resizing the layout
  // viewport, so a dialog sized to it keeps the panel under the keyboard. While
  // the sheet is open the dialog follows the visual viewport, which the
  // keyboard does shrink. The values stay after closing, so the panel does not
  // jump during its exit; the next opening measures again.
  useEffect(() => {
    const element = dialog.current
    const viewport = window.visualViewport
    if (!open || !element || !viewport) return
    const follow = () => {
      const below = document.documentElement.clientHeight - viewport.offsetTop - viewport.height
      element.style.setProperty('--sheet-top', `${String(viewport.offsetTop)}px`)
      element.style.setProperty('--sheet-height', `${String(viewport.height)}px`)
      element.style.setProperty('--sheet-below', `${String(Math.max(0, below))}px`)
    }
    follow()
    viewport.addEventListener('resize', follow)
    viewport.addEventListener('scroll', follow)
    return () => {
      viewport.removeEventListener('resize', follow)
      viewport.removeEventListener('scroll', follow)
    }
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
            className={fullHeight ? 'sheet-panel sheet-panel-full' : 'sheet-panel'}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={reduced ? reducedFade : std}
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
