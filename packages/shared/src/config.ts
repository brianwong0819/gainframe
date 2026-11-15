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
  // The same steps for a weight shown in pounds: a pair of 2.5 lb plates, the
  // next dumbbell or a typical 5 lb stack increment.
  weightStepLb: {
    barbell: 5,
    dumbbell: 5,
    machine: 5,
    cable: 5,
    kettlebell: 5,
    band: 2.5,
    bodyweight: 5,
    other: 2.5,
  },
  // The first set of an exercise never done before.
  firstSet: { weightKg: 0, reps: 8 },
  // An exercise added to a plan day: the common hypertrophy range.
  newPlanItem: { targetSets: 3, repsMin: 8, repsMax: 12 },
  // The rest timer: one tap on -15 s / +15 s, and the rest for an exercise
  // that cannot be found (its default rest is unknown).
  rest: { stepS: 15, fallbackS: 90 },
  // A workout finished this long after its last completed set was most likely
  // left open; its duration then ends at that set.
  forgottenFinishS: 30 * 60,
} as const
