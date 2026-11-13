'use client'

import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'

import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'

import { ExerciseDetail } from './exercise-detail'
import type { LibraryEntry } from './library'

// The exercise detail shown in place of a sheet's other content, with a way
// back to it. It starts at the top of the sheet and focuses the back button,
// since the control that opened it is gone. `children` are its actions.
export function ExerciseDetailView({
  exercise,
  backLabel,
  onBack,
  children,
}: {
  exercise: LibraryEntry
  backLabel: string
  onBack: () => void
  children?: ReactNode
}) {
  const back = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    // The scrolling element is the sheet's panel (src/ui/sheet.tsx).
    const panel = back.current?.closest('.sheet-panel')
    if (panel) panel.scrollTop = 0
    back.current?.focus({ preventScroll: true })
  }, [])

  return (
    <>
      <Pressable
        ref={back}
        onClick={onBack}
        className="flex items-center gap-4 self-start py-8 text-label text-ink-2"
      >
        <Chevron direction="left" />
        {backLabel}
      </Pressable>
      <ExerciseDetail exercise={exercise} />
      {children}
    </>
  )
}
