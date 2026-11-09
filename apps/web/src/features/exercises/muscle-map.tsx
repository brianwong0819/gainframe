import type { MuscleGroup } from '@gainframe/shared'

// A stylised front and back figure side by side in a 248×240 viewBox. Each
// muscle is drawn once for the figure's right side (x < 60) and mirrored; the
// head and neck are drawn whole. Neutral parts (head, joints, hands, feet) use
// the `body-part` class.
type Region = MuscleGroup | 'body'

const HEAD = 'M60 6c-6.5 0-11 5.5-11 14s4.5 14 11 14 11-5.5 11-14-4.5-14-11-14z'
const NECK = 'M54 34h12v7H54z'

const JOINTS = ['M24 125c-1 6 2 11 6 10 3-1 3-6 2-10z', 'M43 179h12v6H43z', 'M45 228h8l1 8H42z']

const front: (readonly [Region, string[]])[] = [
  ['body', [...JOINTS, 'M43 113l15.5 4v8L43 121z']],
  ['shoulders', ['M45 42c-9-1-16 4-17 13 0 4 2 7 5 7l8-11z']],
  ['chest', ['M58.5 44H47c-5 2-8 8-8 14 2 8 11 10 19.5 8z']],
  ['biceps', ['M32 65c-4 7-5 17-4 25h7.5c2-8 2.5-17 2.5-25z']],
  ['forearms', ['M27.5 93c-2 10-3 20-2.5 29h6.5c2-10 4-20 4-29z']],
  ['core', ['M51 70h7.5v41l-7.5-2z', 'M41 68l7.5 2v38l-5.5-4c-2-12-2.5-24-2-36z']],
  ['quads', ['M42 124c-3.5 16-3.5 36 .5 52H56c2-16 2.5-34 2.5-48z']],
  ['calves', ['M43.5 188c-2 14-1.5 26 1.5 37h8c2-11 3-23 2-37z']],
]

const back: (readonly [Region, string[]])[] = [
  ['body', JOINTS],
  [
    'back',
    [
      'M58.5 41H54c-2 1-5 2-9 2l7 9 6.5 6z',
      'M44 54c-3.5 10-3.5 24 1 36l13.5 5V61z',
      'M47.5 94l11 3v15l-11-2z',
    ],
  ],
  ['shoulders', ['M44 43c-8-1-15 3-16 12 0 4 2 7 5 7l8-10z']],
  ['triceps', ['M32 65c-4 7-5 17-4 25h7.5c2-8 2.5-17 2.5-25z']],
  ['forearms', ['M27.5 93c-2 10-3 20-2.5 29h6.5c2-10 4-20 4-29z']],
  ['glutes', ['M43 114c-3 8-1 18 15.5 19v-18z']],
  ['hamstrings', ['M42.5 136c-2.5 14-2 28 .5 40H56c1.5-14 2.5-28 2.5-40z']],
  ['calves', ['M43.5 188c-3 10-2.5 22 1.5 34h8c3-12 3.5-24 2-34z']],
]

type Role = 'primary' | 'secondary' | undefined

function roleOf(region: Region, primary: MuscleGroup, secondary: readonly MuscleGroup[]): Role {
  if (region === 'body') return undefined
  if (primary === 'full_body' || region === primary) return 'primary'
  return secondary.includes(region) ? 'secondary' : undefined
}

function Figure({
  regions,
  x,
  primary,
  secondary,
}: {
  regions: readonly (readonly [Region, string[]])[]
  x: number
  primary: MuscleGroup
  secondary: readonly MuscleGroup[]
}) {
  return (
    <g transform={`translate(${x.toString()} 0)`}>
      <path className="body-part" d={HEAD} />
      <path className="body-part" d={NECK} />
      {regions.flatMap(([region, paths]) => {
        const role = roleOf(region, primary, secondary)
        const className = region === 'body' ? 'body-part' : undefined
        return paths.flatMap((d, index) => [
          <path
            key={`${region}-${index.toString()}`}
            className={className}
            data-role={role}
            d={d}
          />,
          <path
            key={`${region}-${index.toString()}-mirror`}
            className={className}
            data-role={role}
            d={d}
            transform="matrix(-1 0 0 1 120 0)"
          />,
        ])
      })}
    </g>
  )
}

/** Front and back figures with the primary muscle in the accent and the secondary ones lighter. */
export function MuscleMap({
  primary,
  secondary,
  label,
}: {
  primary: MuscleGroup
  secondary: readonly MuscleGroup[]
  label: string
}) {
  return (
    <svg viewBox="0 0 248 240" role="img" aria-label={label} className="muscle-map h-auto w-full">
      <Figure regions={front} x={0} primary={primary} secondary={secondary} />
      <Figure regions={back} x={128} primary={primary} secondary={secondary} />
    </svg>
  )
}
