'use client'

import type { BodyMetric, LocalDate } from '@gainframe/shared'
import { useState } from 'react'

import { Pressable } from '@/ui/pressable'

import { WeighInSheet } from './weigh-in-sheet'

// The latest scan's figures, which the sheet's optional fields start from.
function lastScanOf(rows: readonly BodyMetric[]) {
  const row = rows.findLast(
    (metric) => metric.bodyFatPct !== null && metric.skeletalMuscleKg !== null,
  )
  return row?.bodyFatPct == null || row.skeletalMuscleKg === null
    ? null
    : { bodyFatPct: row.bodyFatPct, skeletalMuscleKg: row.skeletalMuscleKg }
}

// The button that opens the weigh-in sheet, on Today's weight card and docked
// on the weight page. `rows` are the live weigh-ins, oldest first; the sheet
// is mounted afresh on each opening so it starts from the latest one.
export function WeighInButton({
  rows,
  today,
  className,
  children,
}: {
  rows: readonly BodyMetric[]
  today: LocalDate
  className: string
  children: string
}) {
  const [sheet, setSheet] = useState({ open: false, key: 0 })
  return (
    <>
      <Pressable
        onClick={() => {
          setSheet(({ key }) => ({ open: true, key: key + 1 }))
        }}
        className={className}
      >
        {children}
      </Pressable>
      <WeighInSheet
        key={sheet.key}
        open={sheet.open}
        onClose={() => {
          setSheet(({ key }) => ({ open: false, key }))
        }}
        today={today}
        last={rows.at(-1)}
        lastScan={lastScanOf(rows)}
      />
    </>
  )
}
