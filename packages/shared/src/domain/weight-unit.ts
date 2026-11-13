import type { WeightUnit } from '../schemas/workout.ts'

// The international avoirdupois pound, exactly.
const KG_PER_LB = 0.45359237

const round = (value: number, places: number) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// A weight in `unit` as stored: kg, to the nearest 10 g.
export function toKg(value: number, unit: WeightUnit): number {
  return round(unit === 'kg' ? value : value * KG_PER_LB, 2)
}

// A stored weight in `unit`, as shown: kg to 10 g, pounds to 0.1 lb. Storing to
// 10 g moves a weight by at most 0.011 lb, so a weight typed in pounds to 0.1 lb
// reads back as typed.
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? round(kg, 2) : round(kg / KG_PER_LB, 1)
}

// A stored weight as the app shows it in `unit`. Kg weights on the 0.25 kg grid
// of plates and dumbbells (60, 62.5, 1.25) show as stored; anything else, such
// as a weight typed in pounds (10 lb = 4.54 kg), shows to 0.1 kg. Pounds show to
// 0.1 lb.
export function displayWeight(kg: number, unit: WeightUnit): number {
  if (unit === 'lb') return fromKg(kg, 'lb')
  const onGrid = Math.abs(kg * 4 - Math.round(kg * 4)) < 0.004
  return onGrid ? round(kg, 2) : round(kg, 1)
}

// One tap of a stepper of `step` from `value`, both in the shown unit: the next
// multiple of `step` up or down, so taps from an off-grid weight (4.54 kg, from
// 10 lb) land on the grid (5, 7.5, 10) instead of carrying the odd remainder.
// Never below 0.
export function stepToGrid(value: number, step: number, direction: -1 | 1): number {
  const steps = value / step
  // A small tolerance, so a value already on the grid moves a whole step.
  const next = direction === 1 ? Math.floor(steps + 1e-6) + 1 : Math.ceil(steps - 1e-6) - 1
  return Math.max(0, round(next * step, 2))
}
