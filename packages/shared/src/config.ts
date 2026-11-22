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
  // How many of the latest records Today lists.
  recentRecords: 3,
  // The time one set takes, for the estimated length of a planned day.
  setWorkS: 45,
} as const

// Sync limits (ADR-0003), shared so the client batches to what the server accepts.
export const syncConfig = {
  // Rows in one push request.
  pushBatchMax: 200,
  // Rows in one pull page.
  pullPageMax: 500,
  // How far a row's `updatedAt` may be ahead of the server clock. Phone clocks
  // are set from the network and are seconds off at most; a larger lead is a
  // wrong clock, whose rows would otherwise win every later conflict.
  clockSkewMs: 5 * 60 * 1000,
  // A failed sync retries after this delay, doubled after each further failure
  // up to the maximum; a returning connection or the app coming to the
  // foreground tries again at once.
  retryBaseMs: 5 * 1000,
  retryMaxMs: 5 * 60 * 1000,
  // How long the app waits after a change before backing it up, so the sets of
  // a workout logged in quick succession go in one push.
  pushDelayMs: 3 * 1000,
} as const
