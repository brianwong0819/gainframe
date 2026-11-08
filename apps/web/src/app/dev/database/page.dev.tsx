'use client'

// Local database check (M1-02): writes sample rows through the repositories so
// they can be inspected in DevTools → Application → IndexedDB, and shows the row
// and outbox counts on the iPhone, which has no DevTools. Dev builds only; a
// developer tool, so its labels are not in the i18n catalogues.

import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

import { toLocalDate } from '@gainframe/shared'

import { db, repositories } from '@/db/client'
import { type DatabaseSummary, summarize } from '@/db/summary'
import { Pressable } from '@/ui/pressable'

const button = 'rounded-full bg-sunk px-20 py-12 font-semibold text-ink'

async function logSampleWorkout() {
  const now = new Date().toISOString()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const exercise = await repositories.exercises.create({
    nameZh: '杠铃卧推',
    nameEn: 'Barbell bench press',
    muscle: 'chest',
    equipment: 'barbell',
    defaultRestS: 120,
  })
  const workout = await repositories.workouts.create({
    startedAt: now,
    endedAt: null,
    templateId: null,
    localDate: toLocalDate(now, timeZone),
    note: null,
  })
  for (const [position, weightKg] of [60, 62.5, 65].entries()) {
    await repositories.workoutSets.create({
      workoutId: workout.id,
      exerciseId: exercise.id,
      supersetGroup: null,
      position,
      kind: 'working',
      weightKg,
      reps: 8,
      rpe: null,
      completedAt: now,
    })
  }
}

export default function DatabasePage() {
  const [summary, setSummary] = useState<DatabaseSummary | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  // liveQuery re-runs the summary whenever a table it read changes.
  useEffect(() => {
    const subscription = liveQuery(() => summarize(db)).subscribe({ next: setSummary })
    void navigator.storage.persisted().then(setPersisted)
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const latestWorkoutId = summary?.latestWorkoutId ?? null

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-28 px-20 py-40">
      <header className="flex flex-col gap-8">
        <h1 className="text-title">Local database</h1>
        <p className="text-label text-ink-2">
          Rows written here stay on this device. Storage persisted:{' '}
          {persisted === null ? '…' : persisted ? 'yes' : 'no'}
        </p>
      </header>

      <section className="flex flex-col gap-8 rounded-group bg-surface p-16" aria-label="Tables">
        {summary?.tables.map(({ table, live, deleted }) => (
          <p key={table} className="flex justify-between gap-12 text-body">
            <span>{table}</span>
            <span className="num whitespace-nowrap text-label">
              {live} live · {deleted} deleted
            </span>
          </p>
        ))}
        <p className="flex justify-between gap-12 text-body">
          <span>outbox</span>
          <span className="num whitespace-nowrap text-label">{summary?.outbox ?? '…'} pending</span>
        </p>
      </section>

      <div className="flex flex-wrap gap-8">
        <Pressable
          className={button}
          onClick={() => {
            void logSampleWorkout()
          }}
        >
          Log a sample workout
        </Pressable>
        <Pressable
          className={button}
          disabled={latestWorkoutId === null}
          onClick={() => {
            if (latestWorkoutId !== null) void repositories.workouts.remove(latestWorkoutId)
          }}
        >
          Delete the latest workout
        </Pressable>
      </div>
    </main>
  )
}
