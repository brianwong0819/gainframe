'use client'

import { useState } from 'react'

// A name edited in place: saved when the field loses focus or Enter is
// pressed; an empty name is put back.
export function NameField({
  value,
  label,
  onSave,
  className,
}: {
  value: string
  label: string
  onSave: (name: string) => void
  className: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      value={draft ?? value}
      maxLength={80}
      autoComplete="off"
      enterKeyHint="done"
      onFocus={() => {
        setDraft(value)
      }}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onBlur={() => {
        const name = draft?.trim() ?? ''
        if (name !== '' && name !== value) onSave(name)
        setDraft(null)
      }}
      className={`min-w-0 rounded-ctl bg-transparent text-ink focus:bg-sunk ${className}`}
    />
  )
}
