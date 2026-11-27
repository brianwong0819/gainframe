'use client'

import { Pressable } from './pressable'

// A row of equal segments of which exactly one is picked: a chart's range or
// measure ("Progress charts" in docs/design-system.md). Each segment is a
// 44 px target.
export function SegmentedControl<T extends string>({
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
  return (
    <div role="group" aria-label={label} className="flex gap-4 rounded-ctl bg-sunk p-4">
      {options.map((option) => (
        <Pressable
          key={option}
          aria-pressed={option === value}
          onClick={() => {
            onChange(option)
          }}
          className="flex-1 rounded-ctl py-12 text-body text-ink-2 aria-pressed:bg-surface aria-pressed:text-ink"
        >
          {optionLabel(option)}
        </Pressable>
      ))}
    </div>
  )
}
