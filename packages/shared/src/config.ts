// Thresholds used by the domain functions. Change them here, never inline.
export const domainConfig = {
  // Above this many reps an estimated 1RM is too unreliable to report or compare.
  e1rmMaxReps: 12,
  // How much one tap on the weight stepper adds, by equipment, in kg: the
  // smallest common jump (a pair of 1.25 kg plates on a barbell, the next
  // dumbbell in a typical rack, one pin on a machine stack).
  weightStepKg: {
    barbell: 2.5,
    dumbbell: 2,
    machine: 2.5,
    cable: 2.5,
    kettlebell: 4,
    band: 1,
    bodyweight: 2.5,
    other: 1,
  },
  // The first set of an exercise never done before.
  firstSet: { weightKg: 0, reps: 8 },
} as const
