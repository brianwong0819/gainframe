'use client'

import { Pressable } from './pressable'

interface StepperProps {
  value: string
  onStep: (direction: -1 | 1) => void
  decreaseLabel: string
  increaseLabel: string
  canDecrease: boolean
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
 * padding.
 */
export function Stepper({
  value,
  onStep,
  decreaseLabel,
  increaseLabel,
  canDecrease,
}: StepperProps) {
  const button = (direction: -1 | 1, label: string, disabled: boolean) => (
    <Pressable
      aria-label={label}
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
      {button(-1, decreaseLabel, !canDecrease)}
      <span className="num min-w-0 flex-1 text-center text-section" aria-live="polite">
        {value}
      </span>
      {button(1, increaseLabel, false)}
    </div>
  )
}
