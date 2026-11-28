'use client'

import { Pressable } from './pressable'

// A row of equal segments of which exactly one is picked, for 2 to 4 options:
// a chart's range or measure, a meal type, the language ("Selection controls"
// in docs/design-system.md). Each segment is a 44 px target. `optionLang`
// marks an option written in a language other than the page's.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
  optionLang,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  optionLabel: (option: T) => string
  optionLang?: (option: T) => string
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-4 rounded-ctl bg-sunk p-4">
      {options.map((option) => (
        <Pressable
          key={option}
          lang={optionLang?.(option)}
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
