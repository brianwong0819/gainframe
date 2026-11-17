import { Pressable } from '@/ui/pressable'

import { formatRest, REST_MAX_S, REST_STEP_S } from '../exercises/library'

const buttonClass = 'num rounded-full bg-sunk px-16 py-12 text-label disabled:text-ink-3'

// A rest length with 15-second steps either side, shared by a plan item's
// sheet and a superset's sheet.
export function RestStepper({
  label,
  restS,
  lessLabel,
  moreLabel,
  onChange,
}: {
  label: string
  restS: number
  lessLabel: string
  moreLabel: string
  onChange: (restS: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-12">
      <span className="text-label text-ink-3">{label}</span>
      <div className="flex items-center gap-8">
        <Pressable
          aria-label={lessLabel}
          disabled={restS <= 0}
          onClick={() => {
            onChange(Math.max(0, restS - REST_STEP_S))
          }}
          className={buttonClass}
        >
          −15s
        </Pressable>
        <output aria-live="polite" className="num min-w-0 px-8 text-section">
          {formatRest(restS)}
        </output>
        <Pressable
          aria-label={moreLabel}
          disabled={restS >= REST_MAX_S}
          onClick={() => {
            onChange(Math.min(REST_MAX_S, restS + REST_STEP_S))
          }}
          className={buttonClass}
        >
          +15s
        </Pressable>
      </div>
    </div>
  )
}
