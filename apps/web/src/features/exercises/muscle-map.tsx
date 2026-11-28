import type { MuscleGroup, MuscleHeat, TrainedMuscle } from '@gainframe/shared'

import { FIGURE_PARTS, FIGURE_VIEW_BOX, SILHOUETTES } from './muscle-figure'

export type MuscleLevels = Partial<Record<TrainedMuscle, MuscleHeat>>

/** An exercise's muscles as levels: the primary in the accent, the secondary ones lightest. */
export function roleLevels(
  primary: MuscleGroup | null,
  secondary: readonly MuscleGroup[],
): MuscleLevels {
  const levels: MuscleLevels = {}
  for (const muscle of secondary) {
    if (muscle !== 'full_body') levels[muscle] = 1
  }
  if (primary === 'full_body') {
    for (const [part] of FIGURE_PARTS) {
      if (part !== 'none') levels[part] = 3
    }
  } else if (primary) {
    levels[primary] = 3
  }
  return levels
}

/**
 * Front and back figures, each muscle group filled by its level with a solid
 * colour. With `onPick`, tapping a muscle reports it; the regions are too
 * small to be the only control, so every screen that picks also lists the
 * groups as buttons. `selected` outlines that group.
 */
export function MuscleMap({
  levels,
  selected,
  label,
  onPick,
}: {
  levels: MuscleLevels
  selected?: TrainedMuscle | undefined
  label: string
  onPick?: ((muscle: TrainedMuscle) => void) | undefined
}) {
  return (
    <svg
      viewBox={FIGURE_VIEW_BOX}
      role="img"
      aria-label={label}
      data-pickable={onPick ? true : undefined}
      className="muscle-map h-auto w-full"
    >
      {SILHOUETTES.map(({ d, transform }, index) => (
        <path key={index} className="muscle-map-body" d={d} transform={transform} />
      ))}
      {FIGURE_PARTS.map(([part, d], index) => (
        <path
          key={index}
          data-muscle={part === 'none' ? undefined : part}
          data-level={part === 'none' ? 0 : (levels[part] ?? 0)}
          d={d}
          onClick={
            onPick && part !== 'none'
              ? () => {
                  onPick(part)
                }
              : undefined
          }
        />
      ))}
      {selected &&
        FIGURE_PARTS.filter(([part]) => part === selected).map(([, d], index) => (
          <path key={index} className="muscle-map-outline" d={d} />
        ))}
    </svg>
  )
}
