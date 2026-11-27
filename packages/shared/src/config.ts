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
  // Daily targets (M3-02): where the Settings steppers start before the user
  // has set any, and one tap on them. 140 g is 2 g/kg for a 70 kg lifter, in
  // the 1.6 to 2.2 g/kg range of the ISSN position stand on protein (Jäger et
  // al. 2017); 2,800 kcal is a modest surplus for a young man of that weight.
  // M4-01 replaces both with values calculated from the profile.
  targets: { startProteinG: 140, startKcal: 2800, proteinStepG: 5, kcalStep: 50 },
  // The meal type a new meal gets from the hour it is logged, on the device's
  // clock: each type starts at its hour and runs to the next. Hours before
  // breakfast count as a snack (supper).
  mealHours: { breakfast: 5, lunch: 11, snack: 15, dinner: 17, supper: 22 },
  // Frequent foods shown as one-tap pills on the Food tab.
  frequentFoods: 8,
  // Food table matches shown on the manual screen for one search, best first.
  foodTableResults: 20,
  // The oil and sauce row on the photo confirm screen (M3-06). Table figures
  // for a cooked dish already hold its usual oil, so "usual" changes nothing;
  // "less" and "more" take away or add oil worth this share of the meal's
  // weight (3 g per 100 g: about 10 g, roughly a tablespoon, on a 350 g
  // plate), at the energy of fat (Atwater: 9 kcal per g). A rough rule, shown
  // as an estimate; the user can still edit the logged meal.
  oilSauce: { shareOfGrams: 0.03, kcalPerG: 9 },
  // The small / regular / large choice for an estimated item the model is
  // unsure of (M3-06), as shares of the food's typical serving.
  portionSizes: { small: 0.7, regular: 1, large: 1.4 },
  // Named servings one food may have ("1 scoop", "1 bowl").
  foodServingsMax: 6,
  // The target calculator (M4-01). Energy: resting energy by Mifflin-St Jeor
  // (Mifflin et al. 1990) times a physical activity factor (the FAO/WHO/UNU
  // 2004 PAL bands: 1.4 to 1.69 sedentary or light, 1.7 to 1.99 active, 2.0 to
  // 2.4 vigorous, with the commonly used 1.2 to 1.9 multipliers), plus the
  // phase's change. A surplus of 300 kcal suits a lean gain of about 0.25 to
  // 0.5% of body weight a week (Iraki et al. 2019); 400 kcal below balance is
  // a moderate cut. Protein in g per kg of body weight, inside the 1.6 to 2.2
  // range of Jäger et al. 2017, higher in a cut to keep muscle.
  estimate: {
    activityFactors: { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, veryHigh: 1.9 },
    phaseKcal: { bulk: 300, maintain: 0, cut: -400 },
    proteinGPerKg: { bulk: 2.0, maintain: 1.8, cut: 2.2 },
    // Where the calculator's steppers start before any answer: a lifter of 22,
    // 170 cm and 65 kg; and one tap on them.
    start: { ageYears: 22, heightCm: 170, weightKg: 65 },
    step: { heightCm: 1, weightKg: 0.5 },
  },
  // Body weight (M4-02). The trend is the average of the weigh-ins of the seven
  // days ending on each weigh-in; it, the weekly rate and the target range are
  // shown once this many weigh-ins exist. Target rates are % of body weight a
  // week: 0.25 to 0.5 for a lean gain (Iraki et al. 2019, off-season
  // recommendations for bodybuilders), 0.5 to 1 for a cut (Helms et al. 2014,
  // contest preparation), and within the gain's lower bound either side to
  // maintain.
  bodyWeight: {
    trendMinWeighIns: 7,
    // One tap on the weigh-in sheet's steppers: kg, body fat %, muscle kg.
    step: { weightKg: 0.1, bodyFatPct: 0.1, skeletalMuscleKg: 0.1 },
    // Where the optional scan fields start before a first scan: a lean young
    // man's body fat, and skeletal muscle as a share of body weight (about 45%
    // in InBody results for trained men). The user corrects both from their result sheet.
    scanStart: { bodyFatPct: 15, skeletalMuscleShare: 0.45 },
    targetRatePct: {
      bulk: { min: 0.25, max: 0.5 },
      maintain: { min: -0.25, max: 0.25 },
      cut: { min: -1, max: -0.5 },
    },
  },
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
  // A backup that has kept failing this long puts a card on Today
  // ("Accounts and backup" in docs/design-system.md).
  needsUserAfterMs: 24 * 60 * 60 * 1000,
} as const
