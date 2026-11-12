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
