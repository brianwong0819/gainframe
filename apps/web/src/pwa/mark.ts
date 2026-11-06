// The Gainframe mark, a G with a barbell through it, in units from its
// centre. images.ts paints it into the PNG icons and splash screens and
// mark.tsx draws it as SVG, so the launch screen and the app agree.

/** Width of the mark: the length of the bar. */
export const markSpan = 770

export const bar = { length: 770, thickness: 18 } as const

/**
 * Plates on each side of the G, from the inside out: offset from the centre,
 * width, height, corner radius and whether the plate takes the accent colour.
 */
export const plates = [
  { at: 282, width: 44, height: 300, radius: 14, accent: true },
  { at: 329, width: 34, height: 210, radius: 12, accent: true },
  { at: 365, width: 22, height: 70, radius: 8, accent: false },
] as const

/** Share of the screen width the mark takes on the splash and launch screens. */
export const splashMarkShare = 0.42

/** The G: a ring open from 0° to `open` degrees (counter-clockwise from 3 o'clock), and its crossbar. */
export const letterG = { inner: 166, outer: 234, open: 40 } as const

/** Height of the mark: the G is taller than the plates. */
export const markHeight = letterG.outer * 2
