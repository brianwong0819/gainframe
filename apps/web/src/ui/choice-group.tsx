'use client'

import { useId } from 'react'

import { Pressable } from './pressable'
import { SegmentedControl } from './segmented-control'

// Up to this many options sit side by side as segments; more wrap as chips.
const SEGMENTS_MAX = 4

const chipClass =
  'rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

// A labelled choice of which exactly one is picked: segments for 2 to 4 options,
// chips for a longer list ("Selection controls" in docs/design-system.md).
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
  chips = false,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  optionLabel: (option: T) => string
  // Keeps the chips for a short list; the add-food page does, see STATUS.
  chips?: boolean
}) {
  const labelId = useId()
  if (!chips && options.length <= SEGMENTS_MAX) {
    return (
      <div className="flex flex-col gap-8">
        <span aria-hidden="true" className="text-label text-ink-3">
          {label}
        </span>
        <SegmentedControl
          label={label}
          options={options}
          value={value}
          onChange={onChange}
          optionLabel={optionLabel}
        />
      </div>
    )
  }
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
