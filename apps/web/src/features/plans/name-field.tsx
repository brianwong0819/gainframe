'use client'

import { useState } from 'react'

// A name edited in place: saved when the field loses focus or Enter is
// pressed; an empty name is put back. The pencil shows that the text can be
// edited, and a tap on it focuses the field.
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
    <label
      className={`flex min-w-0 items-center gap-8 rounded-ctl focus-within:bg-sunk ${className}`}
    >
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
        className="min-w-0 flex-1 bg-transparent text-ink"
      />
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-16 shrink-0 fill-none stroke-current text-ink-3"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    </label>
  )
}
