'use client'

import { useId } from 'react'

import { Pressable } from './pressable'

const chipClass =
  'rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

// A labelled row of chips of which exactly one is picked.
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  optionLabel: (option: T) => string
}) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-8">
      <span id={labelId} className="text-label text-ink-3">
        {label}
      </span>
      <div className="flex flex-wrap gap-8">
        {options.map((option) => (
          <Pressable
            key={option}
            aria-pressed={option === value}
            onClick={() => {
              onChange(option)
            }}
            className={chipClass}
          >
            {optionLabel(option)}
          </Pressable>
        ))}
      </div>
    </div>
  )
}
