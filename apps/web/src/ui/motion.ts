import type { Transition } from 'motion/react'

// The only motion presets (docs/design-system.md, "Motion"). The CSS
// equivalents in src/styles/tokens.css are generated from these numbers.

export const springs = {
  /** Pages, sheets, tab pill, number roll. */
  std: { stiffness: 380, damping: 30 },
  /** Press release, check mark, icons. */
  pop: { stiffness: 520, damping: 22 },
  /** Progress rings, kcal bar, charts. */
  soft: { stiffness: 120, damping: 20 },
} as const

export const std: Transition = { type: 'spring', ...springs.std }
export const pop: Transition = { type: 'spring', ...springs.pop }
export const soft: Transition = { type: 'spring', ...springs.soft }

/** Press-down only (scale to 0.96); the release uses `pop`. */
export const press: Transition = { type: 'tween', duration: 0.11, ease: [0.3, 0, 0.5, 1] }

/** Colour and opacity changes. */
export const fade: Transition = { type: 'tween', duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }

/** The launch screen's hand-over to the page only: a slow, symmetric dissolve. */
export const dissolve: Transition = { type: 'tween', duration: 0.6, ease: [0.45, 0, 0.55, 1] }

/** What every motion becomes under prefers-reduced-motion. */
export const reducedFade: Transition = { type: 'tween', duration: 0.2, ease: 'linear' }

export const PRESS_SCALE = 0.96
