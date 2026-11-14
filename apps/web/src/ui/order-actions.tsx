import { Pressable } from './pressable'

const buttonClass =
  'rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink disabled:text-ink-3'

// The row of buttons that moves an exercise up or down its list and joins it
// with the next one into a superset (or splits them), shared by the workout's
// exercise sheet and the plan item sheet. `link` is null for the last exercise.
export function OrderActions({
  labels,
  canMove,
  onMove,
  link,
}: {
  labels: { up: string; down: string }
  canMove: (direction: -1 | 1) => boolean
  onMove: (direction: -1 | 1) => void
  link: { label: string; linked: boolean; onToggle: () => void } | null
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {([-1, 1] as const).map((direction) => (
        <Pressable
          key={direction}
          disabled={!canMove(direction)}
          onClick={() => {
            onMove(direction)
          }}
          className={buttonClass}
        >
          {direction === -1 ? labels.up : labels.down}
        </Pressable>
      ))}
      {link && (
        <Pressable aria-pressed={link.linked} onClick={link.onToggle} className={buttonClass}>
          {link.label}
        </Pressable>
      )}
    </div>
  )
}
