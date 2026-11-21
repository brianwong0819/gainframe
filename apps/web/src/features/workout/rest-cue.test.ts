import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A Web Audio stand-in: iOS reports `interrupted` while the page is hidden and
// returns to `running` shortly after it is shown again (ADR-0005).
class FakeAudioContext {
  static last: FakeAudioContext | null = null
  state = 'suspended'
  readonly currentTime = 0
  readonly sampleRate = 44_100
  readonly destination = {}
  oscillators = 0
  resumeAfterMs = 0
  failResume = false

  constructor() {
    FakeAudioContext.last = this
  }

  resume(): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.failResume) {
          reject(new Error('interrupted'))
          return
        }
        this.state = 'running'
        resolve()
      }, this.resumeAfterMs)
    })
  }

  createBuffer() {
    return {}
  }

  createBufferSource() {
    return { buffer: null, connect: () => undefined, start: () => undefined }
  }

  createGain() {
    return {
      gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined },
      connect: (next: unknown) => next,
    }
  }

  createOscillator() {
    this.oscillators += 1
    return {
      frequency: { value: 0 },
      connect: (next: unknown) => next,
      start: () => undefined,
      stop: () => undefined,
    }
  }
}

async function preparedContext() {
  vi.resetModules()
  const cue = await import('./rest-cue')
  cue.prepareRestCue()
  await vi.runAllTimersAsync()
  const audio = FakeAudioContext.last
  if (audio === null) throw new Error('prepareRestCue made no audio context')
  return { cue, audio }
}

describe('playRestCue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('plays three beeps while the context runs', async () => {
    const { cue, audio } = await preparedContext()
    cue.playRestCue()
    expect(audio.oscillators).toBe(3)
  })

  it('waits for a context that iOS is still resuming after the page is shown', async () => {
    const { cue, audio } = await preparedContext()
    audio.state = 'interrupted'
    audio.resumeAfterMs = 50
    cue.playRestCue()
    expect(audio.oscillators).toBe(0)
    await vi.advanceTimersByTimeAsync(50)
    expect(audio.oscillators).toBe(3)
  })

  it('drops a cue whose context resumes too late to mark the end of the rest', async () => {
    const { cue, audio } = await preparedContext()
    audio.state = 'interrupted'
    audio.resumeAfterMs = cue.RESUME_WAIT_MS + 1
    cue.playRestCue()
    await vi.advanceTimersByTimeAsync(cue.RESUME_WAIT_MS + 1)
    expect(audio.oscillators).toBe(0)
  })

  it('stays silent when the context cannot resume', async () => {
    const { cue, audio } = await preparedContext()
    audio.state = 'interrupted'
    audio.failResume = true
    cue.playRestCue()
    await vi.runAllTimersAsync()
    expect(audio.oscillators).toBe(0)
  })

  it('stays silent before a tap has prepared the audio', async () => {
    vi.resetModules()
    const cue = await import('./rest-cue')
    FakeAudioContext.last = null
    cue.playRestCue()
    await vi.runAllTimersAsync()
    expect(FakeAudioContext.last).toBeNull()
  })
})
