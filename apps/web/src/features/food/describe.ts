// The search text the user had typed on the manual screen, handed to the text
// estimate (/food/describe) as its starting description. Kept in memory only.
let pending = ''

export function setPendingText(text: string): void {
  pending = text
}

export function pendingText(): string {
  return pending
}
