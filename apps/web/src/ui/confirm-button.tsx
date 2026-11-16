'use client'

import { useState } from 'react'

import { Pressable } from './pressable'

/** A destructive button that asks once more: the first tap shows `confirmLabel`, the second acts. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  return (
    <Pressable
      onClick={() => {
        if (asking) onConfirm()
        else setAsking(true)
      }}
      className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
    >
      {asking ? confirmLabel : label}
    </Pressable>
  )
}
