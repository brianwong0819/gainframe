'use client'

import { useState } from 'react'

import { Pressable } from './pressable'
import { RollingNumber } from './rolling-number'

interface StepperProps {
  /** What the stepper shows, e.g. "62.5" or the bodyweight label. */
  value: string
  /** The value as typed text when the field is focused, e.g. "" for bodyweight. */
  editValue: string
  inputMode: 'decimal' | 'numeric'
  label: string
  onStep: (direction: -1 | 1) => void
  /** Typed text, sent when the field loses focus or Enter is pressed. */
  onEnter: (text: string) => void
  decreaseLabel: string
  increaseLabel: string
  canDecrease: boolean
  /** A unit shown small after the number, e.g. "g", where nothing else names it. */
  unit?: string
}

function Sign({ plus }: { plus: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-16 fill-none stroke-current"
      strokeWidth={1.75}
      strokeLinecap="round"
    >
      <path d={plus ? 'M6 12h12M12 6v12' : 'M6 12h12'} />
    </svg>
  )
}

/**
 * A number with minus and plus buttons on a `--sunk` track, as in the
 * prototype. Each button's tap target is 48 px: a 40 px circle with 4 px of
 * padding. The number is also a text field: tapping it brings up the keypad
 * (16 px or larger, so iOS does not zoom). Unfocused, the field's text is
 * transparent and the rolling number shows through it.
 */
export function Stepper(props: StepperProps) {
  const { value, editValue, inputMode, label, onStep, onEnter } = props
  const [draft, setDraft] = useState<string | null>(null)
  const button = (direction: -1 | 1, buttonLabel: string, disabled: boolean) => (
    <Pressable
      aria-label={buttonLabel}
      disabled={disabled}
      onClick={() => {
        onStep(direction)
      }}
      className="p-4 text-ink disabled:text-ink-3"
    >
      <span className="flex size-40 items-center justify-center rounded-full bg-surface">
        <Sign plus={direction === 1} />
      </span>
    </Pressable>
  )
  return (
    <div className="flex items-center rounded-full bg-sunk">
      {button(-1, props.decreaseLabel, !props.canDecrease)}
      <span className="relative min-w-0 flex-1">
        <input
          aria-label={label}
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          value={draft ?? value}
          onFocus={(event) => {
            setDraft(editValue)
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onBlur={() => {
            if (draft !== null && draft !== editValue) onEnter(draft)
            setDraft(null)
          }}
          className="peer num absolute inset-0 w-full bg-transparent text-center text-section text-transparent caret-transparent focus:text-ink focus:caret-ink"
        />
        <span
          aria-hidden
          className="num pointer-events-none flex items-baseline justify-center gap-4 text-section peer-focus:opacity-0"
        >
          <RollingNumber value={value} />
          {props.unit !== undefined && <span className="text-label text-ink-3">{props.unit}</span>}
        </span>
      </span>
      {button(1, props.increaseLabel, false)}
    </div>
  )
}
