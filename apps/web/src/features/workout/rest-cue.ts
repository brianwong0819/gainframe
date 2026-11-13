// The rest timer's sound and screen wake lock (ADR-0005, layers 1 and 2).
// iOS unlocks audio only inside a tap, so `prepareRestCue` runs in the tap that
// completes a set; the cue itself plays later from a timer while the page is
// visible. Nothing is scheduled on the audio clock in advance: that clock
// stops while iOS hides the page and would play a stale cue on return.

// The Audio Session API (Safari 16.4+) is not in TypeScript's DOM library yet.
// https://w3c.github.io/audio-session/
declare global {
  interface Navigator {
    readonly audioSession?: { type: string }
  }
}

// `transient`: a short sound that mixes with the user's music. It is silent
// with the ringer switch off; `playback` would play but stops the music
// (measured on the iPhone, ADR-0005).
const SESSION_TYPE = 'transient'

// Three rising beeps, loud and long enough to notice in a gym.
const BEEPS_HZ = [880, 1100, 1320]
const BEEP_S = 0.22
const BEEP_GAP_S = 0.3
const GAIN = 0.7

let context: AudioContext | null = null
let wakeLock: WakeLockSentinel | null = null

export function prepareRestCue(): void {
  if (typeof AudioContext === 'undefined') return
  if (navigator.audioSession) navigator.audioSession.type = SESSION_TYPE
  context ??= new AudioContext()
  const audio = context
  // Playing one silent frame inside the tap unlocks later playback on iOS.
  audio.resume().then(
    () => {
      const source = audio.createBufferSource()
      source.buffer = audio.createBuffer(1, 1, audio.sampleRate)
      source.connect(audio.destination)
      source.start()
    },
    () => {
      // Not unlocked; the rest still shows on screen.
    },
  )
}

export function playRestCue(): void {
  const audio = context
  if (audio?.state !== 'running') return
  const start = audio.currentTime + 0.01
  BEEPS_HZ.forEach((hz, index) => {
    const at = start + index * BEEP_GAP_S
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.frequency.value = hz
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(GAIN, at + 0.01)
    gain.gain.linearRampToValueAtTime(0, at + BEEP_S)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(at)
    oscillator.stop(at + BEEP_S)
  })
}

// Keeps the screen on while a workout is open. iOS releases the lock whenever
// the page is hidden, so it is requested again on each return and each tap.
export function keepScreenOn(): void {
  if (!('wakeLock' in navigator) || (wakeLock !== null && !wakeLock.released)) return
  navigator.wakeLock.request('screen').then(
    (lock) => {
      wakeLock = lock
    },
    () => {
      // Refused (no user gesture yet, low power mode); the next tap tries again.
    },
  )
}

export function allowScreenOff(): void {
  void wakeLock?.release()
  wakeLock = null
}
