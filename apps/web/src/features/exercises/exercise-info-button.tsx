'use client'

import { Pressable } from '@/ui/pressable'

// The ⓘ that opens an exercise's detail (muscle map, cues) wherever the
// exercise is listed: the icon alone, named by `label` for screen readers, or
// with `label` written beside it (`showLabel`) where there is room.
export function ExerciseInfoButton({
  label,
  showLabel = false,
  onClick,
}: {
  label: string
  showLabel?: boolean
  onClick: () => void
}) {
  return (
    <Pressable
      aria-label={showLabel ? undefined : label}
      onClick={onClick}
      className={
        !showLabel
          ? '-m-8 shrink-0 rounded-full p-8 text-ink-3'
          : 'flex items-center gap-8 self-start rounded-full bg-sunk py-8 pr-16 pl-12 text-label font-semibold text-ink'
      }
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-20 fill-none stroke-current"
        strokeWidth={1.75}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5v.01" />
      </svg>
      {showLabel && label}
    </Pressable>
  )
}
