'use client'

import {
  domainConfig,
  type RestState,
  restState,
  type WeightUnit,
  type Workout,
  type WorkoutSet,
} from '@gainframe/shared'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { workoutSession } from '@/db/client'
import { fade, pop, reducedFade, soft } from '@/ui/motion'
import { Pressable } from '@/ui/pressable'

import { formatClock } from './clock'
import { formatSetWeight } from './exercise-info'
import { playRestCue } from './rest-cue'

// How often the countdown redraws, and how the end-of-rest cue repeats when the
// rest ends on screen. A rest that ended while the app was hidden plays the cue
// once on return instead (ADR-0005, layer 2).
const TICK_MS = 250
const CUE_EVERY_MS = 2500
const CUE_REPEATS = 24
// A rest first seen already over by more than this ended while the app was hidden.
const SEEN_LATE_MS = 2000

export interface RestView {
  state: RestState
  // The rest ended while the app was hidden or closed, so no cue played on time.
  endedAway: boolean
}

const clock = (ms: number) => formatClock(Math.round(ms / 1000))

// The workout's rest, recomputed from its stored end on every tick and on each
// return to the page; null when no rest is running. Plays the cue when the
// rest ends, until `endRest` clears it.
export function useRest(workout: Workout): RestView | null {
  const { restStartedAt, restEndsAt } = workout
  const [now, setNow] = useState(() => Date.now())
  // The end of a rest the app was away for: hidden while it ran, or already
  // over when the screen opened (iOS ended the app).
  const [away, setAway] = useState(() =>
    restEndsAt !== null && Date.parse(restEndsAt) < Date.now() - SEEN_LATE_MS ? restEndsAt : null,
  )
  const cued = useRef<string | null>(null)

  useEffect(() => {
    if (restEndsAt === null) return
    const tick = () => {
      setNow(Date.now())
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && Date.now() < Date.parse(restEndsAt)) {
        setAway(restEndsAt)
      }
      tick()
    }
    const timer = setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [restEndsAt])

  const state =
    restStartedAt === null || restEndsAt === null
      ? null
      : // A new rest can render before the next tick: never count from before it began.
        restState({ restStartedAt, restEndsAt }, Math.max(now, Date.parse(restStartedAt)))
  const over = state?.phase === 'over'

  useEffect(() => {
    if (!over || restEndsAt === null || cued.current === restEndsAt) return
    if (document.visibilityState !== 'visible') return
    cued.current = restEndsAt
    playRestCue()
    if (Date.now() - Date.parse(restEndsAt) > SEEN_LATE_MS) return
    let repeats = 1
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') playRestCue()
      repeats += 1
      if (repeats >= CUE_REPEATS) clearInterval(timer)
    }, CUE_EVERY_MS)
    return () => {
      clearInterval(timer)
    }
  }, [over, restEndsAt])

  return state && { state, endedAway: over && away === restEndsAt }
}

function endRest(workout: Workout) {
  void workoutSession.endRest(workout.id)
}

// The progress ring of the prototype: it empties as the rest runs out.
function Ring({ state, size }: { state: RestState; size: 'large' | 'small' }) {
  const reduced = useReducedMotion() ?? false
  const left = state.phase === 'running' ? state.remainingMs / state.totalMs : 0
  const stroke = size === 'large' ? 4 : 10
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="size-full -rotate-90 fill-none">
      <circle cx="50" cy="50" r={50 - stroke} strokeWidth={stroke} className="stroke-sunk" />
      <motion.circle
        cx="50"
        cy="50"
        r={50 - stroke}
        strokeWidth={stroke}
        strokeLinecap="round"
        className="stroke-accent"
        initial={false}
        animate={{ pathLength: left, opacity: left > 0 ? 1 : 0 }}
        transition={reduced ? reducedFade : { pathLength: soft, opacity: fade }}
      />
    </svg>
  )
}

// The set that follows the rest, so the next weight is known before the rest ends.
export interface NextSet {
  set: WorkoutSet
  name: string
  n: number
  // How many sets the exercise has, for "set 2/3".
  of: number
  unit: WeightUnit
  bodyweight: boolean
}

// The rest sheet's content: the ring with the time left, the set that comes
// next, ±15 s, and "start the next set", which ends the rest. Once over, it
// shows how long ago it ended.
export function RestPanel({
  workout,
  rest,
  next,
}: {
  workout: Workout
  rest: RestView
  next: NextSet | null
}) {
  const t = useTranslations('workout')
  const { state } = rest
  const step = domainConfig.rest.stepS
  const adjust = (deltaS: number) => {
    void workoutSession.adjustRest(workout.id, deltaS)
  }
  return (
    <div className="flex flex-col items-center gap-20">
      <div className="relative aspect-square w-3/5">
        <Ring state={state} size="large" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className="num text-display" role="timer">
            {state.phase === 'running' ? clock(state.remainingMs) : clock(state.overdueMs)}
          </span>
          <span className={`text-label ${state.phase === 'over' ? 'text-accent' : 'text-ink-2'}`}>
            {state.phase === 'running' ? t('restLeft') : t('restOver')}
          </span>
        </div>
      </div>
      {rest.endedAway && <p className="text-center text-label text-ink-2">{t('restAwayHint')}</p>}
      {next && (
        <p className="flex w-full items-center justify-between gap-12 rounded-ctl bg-sunk px-16 py-12">
          <span className="flex min-w-0 flex-col">
            <span className="text-label text-ink-3">{t('restNext')}</span>
            <span className="truncate text-body font-semibold text-ink">
              {next.name} · {t('colSet')} {next.n}/{next.of}
            </span>
          </span>
          <span className="num shrink-0 text-body text-ink">
            {formatSetWeight(next.set.weightKg, next.unit, next.bodyweight, t('bodyweight'))}
            {!(next.bodyweight && next.set.weightKg === 0) && (
              <span className="text-label text-ink-3"> {t(`unit.${next.unit}`)}</span>
            )}
            {' × '}
            {next.set.reps}
          </span>
        </p>
      )}
      <div className="grid w-full grid-cols-[1fr_1fr_4fr] gap-8">
        <Pressable
          onClick={() => {
            adjust(-step)
          }}
          disabled={state.phase === 'over'}
          aria-label={t('restLess', { s: step })}
          className="num rounded-ctl bg-sunk py-12 text-body text-ink disabled:text-ink-3"
        >
          −{step}
        </Pressable>
        <Pressable
          onClick={() => {
            adjust(step)
          }}
          aria-label={t('restMore', { s: step })}
          className="num rounded-ctl bg-sunk py-12 text-body text-ink"
        >
          +{step}
        </Pressable>
        <Pressable
          onClick={() => {
            endRest(workout)
          }}
          className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
        >
          {t('restDone')}
        </Pressable>
      </div>
    </div>
  )
}

// The rest collapsed to a pill above the set panel. A tap opens the sheet
// while the rest runs; once over, a tap stops the cue and ends the rest.
export function RestPill({
  workout,
  rest,
  onOpen,
}: {
  workout: Workout
  rest: RestView
  onOpen: () => void
}) {
  const t = useTranslations('workout')
  const reduced = useReducedMotion() ?? false
  const { state } = rest
  const over = state.phase === 'over'
  return (
    <motion.div
      className="self-center"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
      transition={reduced ? reducedFade : { scale: pop, opacity: fade }}
    >
      <Pressable
        onClick={() => {
          if (over) endRest(workout)
          else onOpen()
        }}
        aria-label={over ? t('restStop') : t('restOpen')}
        className={`flex items-center gap-8 rounded-full py-8 pr-16 pl-8 text-label font-semibold ${over ? 'bg-accent text-accent-ink' : 'bg-ink text-bg'}`}
      >
        <span className="size-28">
          <Ring state={state} size="small" />
        </span>
        <span>{over ? t('restOver') : t('rest')}</span>
        <span className="num">
          {over ? `+${clock(state.overdueMs)}` : clock(state.remainingMs)}
        </span>
      </Pressable>
    </motion.div>
  )
}
