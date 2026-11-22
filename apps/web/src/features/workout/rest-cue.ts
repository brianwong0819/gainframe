// The rest timer's sound and screen wake lock (ADR-0005, layers 1 and 2).
// iOS unlocks audio only inside a tap, so `prepareRestCue` runs in the tap that
// completes a set and in every other tap while a workout is open; the cue
// itself plays later from a timer while the page is visible. Nothing is
// scheduled on the audio clock in advance: that clock stops while iOS hides
// the page and would play a stale cue on return.
// iOS interrupts the audio context while the page is hidden. On return it may
// take about 50 ms to resume (ADR-0005), or come back reporting `running`
// while it plays nothing (WebKit bugs 263627, 276016). So a cue asked for
// while the context is not running waits for it to resume, the context is
// suspended and resumed on each return (the workaround in those bugs), and
// the first tap after the page was hidden replaces the context.

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
// How long a cue waits for an interrupted context; later than that it would
// no longer mark the end of the rest.
export const RESUME_WAIT_MS = 1000

let context: AudioContext | null = null
// The page was hidden after `context` was made, so it may be silent.
let hiddenSinceCreated = false
let wakeLock: WakeLockSentinel | null = null

export function prepareRestCue(): void {
  if (typeof AudioContext === 'undefined') return
  if (navigator.audioSession) navigator.audioSession.type = SESSION_TYPE
  if (context === null || context.state === 'closed' || hiddenSinceCreated) {
    context?.close().catch(() => {
      // Already closed.
    })
    context = new AudioContext()
    hiddenSinceCreated = false
  }
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

// Keeps the cue's audio usable while a workout is open; returns the cleanup.
export function watchRestCue(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenSinceCreated = true
      return
    }
    const audio = context
    if (audio?.state !== 'running') return
    audio
      .suspend()
      .then(() => audio.resume())
      .catch(() => {
        // Left suspended; the cue resumes it, and the next tap replaces it.
      })
  }
  const onTap = () => {
    prepareRestCue()
  }
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('touchend', onTap, { capture: true, passive: true })
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('touchend', onTap, { capture: true })
  }
}

export function playRestCue(): void {
  const audio = context
  if (audio === null || audio.state === 'closed') return
  if (audio.state === 'running') {
    beep(audio)
    return
  }
  const askedAt = Date.now()
  audio.resume().then(
    () => {
      if (audio.state === 'running' && Date.now() - askedAt <= RESUME_WAIT_MS) beep(audio)
    },
    () => {
      // Still interrupted (a call, another app's audio); the rest shows on screen.
    },
  )
}

function beep(audio: AudioContext): void {
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
