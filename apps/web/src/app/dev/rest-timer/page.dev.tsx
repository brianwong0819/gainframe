'use client'

// Rest-timer field test (M0-13): bw runs it at the gym on the iPhone home
// screen app to learn how iOS treats a countdown, the screen wake lock and an
// audio cue when the phone locks, another app opens or a call comes in. Built
// only for `next dev` and the dev deploy; a test instrument for the developer,
// so its labels are not in the i18n catalogues.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { release } from '@/release'
import { Pressable } from '@/ui/pressable'

import {
  audioSessionTypes,
  appendLog as record,
  clearLog,
  logSnapshot,
  serverLogSnapshot,
  subscribeLog,
  formatEntry,
  loadRunEnd,
  saveRunEnd,
  scheduleCue,
  setAudioSessionType,
  unlockAudio,
} from './probe'
import type { AudioSessionType } from './probe'

const durations = [30, 90, 180] as const

interface Run {
  endAt: number
  wallStart: number
  audioStart: number
  cueAt: number
  cue: OscillatorNode[]
}

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
}

function errorName(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error'
}

export default function RestTimerPage() {
  const [duration, setDuration] = useState<number>(90)
  const [sessionType, setSessionType] = useState<AudioSessionType>('auto')
  const [endAt, setEndAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const log = useSyncExternalStore(subscribeLog, logSnapshot, serverLogSnapshot)
  const [copied, setCopied] = useState(false)

  const context = useRef<AudioContext | null>(null)
  const run = useRef<Run | null>(null)
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  /** How far the audio clock fell behind the wall clock since the start. */
  const audioLag = useCallback((current: Run, audio: AudioContext) => {
    const wall = (Date.now() - current.wallStart) / 1000
    return Math.max(0, wall - (audio.currentTime - current.audioStart)).toFixed(1)
  }, [])

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      record('wake lock not supported')
      return
    }
    try {
      const lock = await navigator.wakeLock.request('screen')
      lock.addEventListener('release', () => {
        record('wake lock released')
      })
      wakeLock.current = lock
      record('wake lock on')
    } catch (error) {
      record(`wake lock failed (${errorName(error)})`)
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    void wakeLock.current?.release()
    wakeLock.current = null
  }, [])

  const finish = useCallback(() => {
    const current = run.current
    if (current === null) return
    run.current = null
    saveRunEnd(null)
    setEndAt(null)
    const audio = context.current
    const heard =
      audio === null
        ? ''
        : `; audio ${audio.state}, cue ${audio.currentTime >= current.cueAt ? 'played' : 'not played yet'}, audio clock behind by ${audioLag(current, audio)} s`
    record(
      `countdown ended, page noticed ${String(Date.now() - current.endAt)} ms late (${document.visibilityState})${heard}`,
    )
    releaseWakeLock()
  }, [audioLag, releaseWakeLock])

  // Restores the log and notes whether iOS reloaded the page mid-countdown.
  useEffect(() => {
    const previousEnd = loadRunEnd()
    const standalone = matchMedia('(display-mode: standalone)').matches
    record(`page loaded, release ${release.slice(0, 7)}, standalone ${standalone ? 'yes' : 'no'}`)
    if (previousEnd !== null) {
      const left = Math.round((previousEnd - Date.now()) / 1000)
      record(`page was reloaded during a countdown (${String(left)} s left at reload)`)
      saveRunEnd(null)
    }
  }, [])

  // Page lifecycle: what iOS does when the phone locks or another app opens.
  useEffect(() => {
    const onVisibility = () => {
      const current = run.current
      const audio = context.current
      const detail =
        current !== null && audio !== null
          ? `, ${formatClock(current.endAt - Date.now())} left, audio ${audio.state}, audio clock behind by ${audioLag(current, audio)} s`
          : ''
      record(`page ${document.visibilityState}${detail}`)
      if (
        document.visibilityState === 'visible' &&
        current !== null &&
        wakeLock.current?.released !== false
      ) {
        void acquireWakeLock()
      }
    }
    const onPageHide = (event: PageTransitionEvent) => {
      record(`pagehide (persisted ${event.persisted ? 'yes' : 'no'})`)
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) record('pageshow from back-forward cache')
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [acquireWakeLock, audioLag])

  // Redraws every frame; a timeout also fires at the deadline, which shows
  // whether timers run while the page is hidden.
  useEffect(() => {
    if (endAt === null) return
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= endAt) finish()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const timeout = setTimeout(finish, endAt - Date.now())
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
    }
  }, [endAt, finish])

  /** Must run inside the tap: iOS unlocks audio only during a user gesture. */
  const audioForTap = () => {
    const supported = setAudioSessionType(sessionType)
    const audio = context.current ?? new AudioContext()
    if (context.current === null) {
      audio.addEventListener('statechange', () => {
        record(`audio ${audio.state}`)
      })
      context.current = audio
    }
    unlockAudio(audio).catch((error: unknown) => {
      record(`audio unlock failed (${errorName(error)})`)
    })
    return { audio, supported }
  }

  const start = () => {
    const { audio, supported } = audioForTap()
    const wallStart = Date.now()
    const next: Run = {
      endAt: wallStart + duration * 1000,
      wallStart,
      audioStart: audio.currentTime,
      cueAt: audio.currentTime + duration,
      cue: scheduleCue(audio, duration),
    }
    run.current = next
    saveRunEnd(next.endAt)
    setNow(wallStart)
    setEndAt(next.endAt)
    record(
      `start ${String(duration)} s, audio session ${supported ? sessionType : 'not supported'}, audio ${audio.state}`,
    )
    void acquireWakeLock()
  }

  const stop = () => {
    const current = run.current
    if (current === null) return
    for (const oscillator of current.cue) oscillator.stop()
    run.current = null
    saveRunEnd(null)
    setEndAt(null)
    record(`stopped with ${formatClock(current.endAt - Date.now())} left`)
    releaseWakeLock()
  }

  const testCue = () => {
    const { audio, supported } = audioForTap()
    scheduleCue(audio, 0.05)
    record(`test cue, audio session ${supported ? sessionType : 'not supported'}`)
  }

  const copyLog = () => {
    navigator.clipboard.writeText(log.map(formatEntry).join('\n')).then(
      () => {
        setCopied(true)
      },
      (error: unknown) => {
        record(`copy failed (${errorName(error)})`)
      },
    )
  }

  const clear = () => {
    clearLog()
    setCopied(false)
  }

  const running = endAt !== null
  const pill = (selected: boolean) =>
    `rounded-full px-16 py-12 text-label ${selected ? 'bg-ink text-bg' : 'bg-sunk text-ink'}`

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-28 px-20 py-40">
      <header className="flex flex-col gap-8">
        <h1 className="text-title">Rest timer test</h1>
        <p className="text-label text-ink-2">
          Start, then lock the phone, switch apps or take a call. Copy the log afterwards.
        </p>
      </header>

      <section className="flex flex-col gap-16 rounded-group bg-surface p-16">
        <p className="num text-center text-title" aria-live="off">
          {formatClock(running ? endAt - now : duration * 1000)}
        </p>
        <div className="flex justify-center gap-8" role="group" aria-label="Rest length">
          {durations.map((value) => (
            <Pressable
              key={value}
              aria-pressed={duration === value}
              disabled={running}
              onClick={() => {
                setDuration(value)
              }}
              className={pill(duration === value)}
            >
              <span className="num">{value}</span> s
            </Pressable>
          ))}
        </div>
        <Pressable
          onClick={running ? stop : start}
          className={`rounded-full px-20 py-12 font-semibold ${running ? 'bg-sunk text-ink' : 'bg-accent text-accent-ink'}`}
        >
          {running ? 'Stop' : 'Start'}
        </Pressable>
      </section>

      <section className="flex flex-col gap-12">
        <h2 className="text-section">Audio session</h2>
        <p className="text-label text-ink-2">
          Decides whether the cue plays in silent mode and how it mixes with music.
        </p>
        <div className="flex flex-wrap gap-8" role="group" aria-label="Audio session">
          {audioSessionTypes.map((value) => (
            <Pressable
              key={value}
              aria-pressed={sessionType === value}
              disabled={running}
              onClick={() => {
                setSessionType(value)
              }}
              className={pill(sessionType === value)}
            >
              {value}
            </Pressable>
          ))}
        </div>
        <Pressable onClick={testCue} className={`self-start ${pill(false)}`}>
          Play cue now
        </Pressable>
      </section>

      <section className="flex flex-col gap-12">
        <div className="flex items-center justify-between gap-8">
          <h2 className="text-section">Log</h2>
          <div className="flex gap-8">
            <Pressable onClick={copyLog} className={pill(false)}>
              {copied ? 'Copied' : 'Copy'}
            </Pressable>
            <Pressable onClick={clear} className={pill(false)}>
              Clear
            </Pressable>
          </div>
        </div>
        <ol className="flex flex-col gap-4 rounded-group bg-surface p-16">
          {log.toReversed().map((entry, index) => (
            <li key={log.length - index} className="num text-label break-words text-ink-2">
              {formatEntry(entry)}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
