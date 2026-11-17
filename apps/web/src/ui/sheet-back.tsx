'use client'

import { useLayoutEffect, useRef } from 'react'

import { Chevron } from './chevron'
import { Pressable } from './pressable'

// The way back when a sheet swaps its content in place (a list, then one
// item's detail or a form). The new content starts at the top of the sheet and
// this button takes focus, since the control that opened it is gone.
export function SheetBack({ label, onBack }: { label: string; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    // The scrolling element is the sheet's panel (src/ui/sheet.tsx).
    const panel = back.current?.closest('.sheet-panel')
    if (panel) panel.scrollTop = 0
    back.current?.focus({ preventScroll: true })
  }, [])

  return (
    <Pressable
      ref={back}
      onClick={onBack}
      className="flex items-center gap-4 self-start py-8 text-label text-ink-2"
    >
      <Chevron direction="left" />
      {label}
    </Pressable>
  )
}
