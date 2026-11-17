'use client'

import type { ReactNode } from 'react'

import { SheetBack } from '@/ui/sheet-back'

import { ExerciseDetail } from './exercise-detail'
import type { LibraryEntry } from './library'

// The exercise detail shown in place of a sheet's other content, with a way
// back to it. `children` are its actions.
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
  return (
    <>
      <SheetBack label={backLabel} onBack={onBack} />
      <ExerciseDetail exercise={exercise} />
      {children}
    </>
  )
}
