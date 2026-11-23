'use client'

import type { ReactNode } from 'react'

// A button that opens the system picker (camera or library) through a file
// input; there is no custom camera (design-system.md, "Photo flow").
export function PhotoPicker({
  onPick,
  className,
  children,
}: {
  onPick: (photo: File) => void
  className: string
  children: ReactNode
}) {
  return (
    <label className={`cursor-pointer has-focus-visible:outline-2 ${className}`}>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const photo = event.target.files?.[0]
          // Cleared, so picking the same photo again still fires a change.
          event.target.value = ''
          if (photo !== undefined) onPick(photo)
        }}
      />
      {children}
    </label>
  )
}
