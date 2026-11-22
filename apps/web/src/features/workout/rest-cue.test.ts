import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A Web Audio stand-in: iOS reports `interrupted` while the page is hidden and
// returns to `running` shortly after it is shown again (ADR-0005).
class FakeAudioContext {
  static last: FakeAudioContext | null = null
  static made = 0
  state = 'suspended'
  readonly currentTime = 0
  readonly sampleRate = 44_100
  readonly destination = {}
  oscillators = 0
  resumeAfterMs = 0
  failResume = false

  suspends = 0
  resumes = 0

  constructor() {
    FakeAudioContext.last = this
    FakeAudioContext.made += 1
  }

  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }

  suspend(): Promise<void> {
    this.suspends += 1
    this.state = 'suspended'
    return Promise.resolve()
  }

  resume(): Promise<void> {
    this.resumes += 1
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.failResume || this.state === 'closed') {
          reject(new Error('cannot resume'))
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

// The page's visibility, with the events the cue listens to.
const page = Object.assign(new EventTarget(), { visibilityState: 'visible' })

function setVisibility(state: 'hidden' | 'visible') {
  page.visibilityState = state
  page.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('document', page)
  page.visibilityState = 'visible'
  FakeAudioContext.made = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('playRestCue', () => {
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

describe('watchRestCue', () => {
  it('keeps the context while the page stays visible', async () => {
    const { cue } = await preparedContext()
    const stop = cue.watchRestCue()
    cue.prepareRestCue()
    expect(FakeAudioContext.made).toBe(1)
    stop()
  })

  it('suspends and resumes the context when the page is shown again', async () => {
    const { cue, audio } = await preparedContext()
    const stop = cue.watchRestCue()
    setVisibility('hidden')
    setVisibility('visible')
    await vi.runAllTimersAsync()
    expect(audio.suspends).toBe(1)
    expect(audio.state).toBe('running')
    stop()
  })

  it('replaces the context at the first tap after the page was hidden', async () => {
    const { cue, audio } = await preparedContext()
    const stop = cue.watchRestCue()
    setVisibility('hidden')
    setVisibility('visible')
    page.dispatchEvent(new Event('touchend'))
    await vi.runAllTimersAsync()
    expect(audio.state).toBe('closed')
    expect(FakeAudioContext.made).toBe(2)
    const fresh = FakeAudioContext.last
    cue.playRestCue()
    expect(fresh?.oscillators).toBe(3)
    stop()
  })

  it('stops listening after cleanup', async () => {
    const { cue } = await preparedContext()
    cue.watchRestCue()()
    setVisibility('hidden')
    page.dispatchEvent(new Event('touchend'))
    expect(FakeAudioContext.made).toBe(1)
  })
})
