// The workout finished in this visit to the app, so its summary celebrates it
// once (a ripple), and not again when it is opened from history or reloaded.
let justFinished: string | null = null

export function markJustFinished(workoutId: string) {
  justFinished = workoutId
}

export function takeJustFinished(workoutId: string): boolean {
  if (justFinished !== workoutId) return false
  justFinished = null
  return true
}
