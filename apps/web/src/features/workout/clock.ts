// Seconds as a running clock: "0:07", "14:32", and "1:02:05" from an hour on.
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const pad = (value: number) => String(value).padStart(2, '0')
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds % 60)}`
    : `${String(minutes)}:${pad(seconds % 60)}`
}
