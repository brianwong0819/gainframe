// Browser plumbing for the rest-timer field test (M0-13): a persisted event
// log, the audio cue and the screen wake lock. Findings feed ADR-0005.

// The Audio Session API (Safari 16.4+) is not in TypeScript's DOM library yet.
// https://w3c.github.io/audio-session/
declare global {
  interface Navigator {
    readonly audioSession?: { type: AudioSessionType }
  }
}

export const audioSessionTypes = ['auto', 'ambient', 'transient', 'playback'] as const
export type AudioSessionType = (typeof audioSessionTypes)[number]

export interface LogEntry {
  readonly at: number
  readonly event: string
}

const logKey = 'gainframe.dev.rest-timer.log'
const runKey = 'gainframe.dev.rest-timer.run'
const maxEntries = 300

// Storage can be unavailable (private mode, blocked site data); the page then
// works without persistence.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not persisted; the in-memory log still shows the entry.
  }
}

function isEntry(value: unknown): value is LogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'at' in value &&
    typeof value.at === 'number' &&
    'event' in value &&
    typeof value.event === 'string'
  )
}

function loadLog(): LogEntry[] {
  const raw = read(logKey)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

const noEntries: readonly LogEntry[] = []
let entries: readonly LogEntry[] | null = null
const listeners = new Set<() => void>()

function setEntries(next: readonly LogEntry[]): void {
  entries = next
  write(logKey, JSON.stringify(next))
  for (const listener of listeners) listener()
}

// The event log is an external store for `useSyncExternalStore`.
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function logSnapshot(): readonly LogEntry[] {
  entries ??= loadLog()
  return entries
}

/** The prerendered page shows an empty log. */
export function serverLogSnapshot(): readonly LogEntry[] {
  return noEntries
}

export function appendLog(event: string): void {
  setEntries([...logSnapshot(), { at: Date.now(), event }].slice(-maxEntries))
}

export function clearLog(): void {
  setEntries(noEntries)
}

/** The end of the running countdown, kept so a reload by iOS can be detected. */
export function loadRunEnd(): number | null {
  const value = Number(read(runKey))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function saveRunEnd(endAt: number | null): void {
  write(runKey, endAt === null ? null : String(endAt))
}

export function formatEntry(entry: LogEntry): string {
  const time = new Date(entry.at).toLocaleTimeString('en-GB', { hour12: false })
  const ms = String(entry.at % 1000).padStart(3, '0')
  return `${time}.${ms} ${entry.event}`
}

export function setAudioSessionType(type: AudioSessionType): boolean {
  if (navigator.audioSession === undefined) return false
  navigator.audioSession.type = type
  return true
}

const beepHz = 880
const beepSeconds = 0.15
const beepGap = 0.25
const beepCount = 3

/** Schedules three short beeps on the audio clock, `delay` seconds from now. */
export function scheduleCue(context: AudioContext, delay: number): OscillatorNode[] {
  const start = context.currentTime + delay
  return Array.from({ length: beepCount }, (_, index) => {
    const at = start + index * beepGap
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = beepHz
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.5, at + 0.01)
    gain.gain.linearRampToValueAtTime(0, at + beepSeconds)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + beepSeconds)
    return oscillator
  })
}

/**
 * iOS starts an AudioContext only inside a user gesture. Resuming it and
 * playing one silent frame during the tap unlocks it for later cues.
 */
export async function unlockAudio(context: AudioContext): Promise<void> {
  await context.resume()
  const source = context.createBufferSource()
  source.buffer = context.createBuffer(1, 1, context.sampleRate)
  source.connect(context.destination)
  source.start()
}
