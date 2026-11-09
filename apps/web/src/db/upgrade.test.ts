import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { GainframeDb, STORES_V1 } from './schema'

// Data on the phone cannot be repaired from the server, so every schema
// version is opened over a database written by the version before it.
describe('Dexie schema upgrades', () => {
  it('keeps version 1 rows when upgrading', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v1 = new Dexie('upgrade', options)
    v1.version(1).stores(STORES_V1)
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-08T10:00:00.000Z',
      endedAt: null,
      templateId: null,
      localDate: '2026-11-08',
      note: null,
    }
    await v1.table('workouts').add(workout)
    await v1.table('outbox').add({ table: 'workouts', rowId: workout.id })
    v1.close()

    const current = new GainframeDb('upgrade', options)
    const { templateId, ...rest } = workout
    expect(await current.workouts.get(workout.id)).toEqual({ ...rest, planDayId: templateId })
    expect(await current.outbox.toArray()).toEqual([
      { seq: 1, table: 'workouts', rowId: workout.id },
    ])
    expect(await current.errors.count()).toBe(0)
    expect(current.verno).toBe(6)
    current.close()
  })

  it('gives version 2 custom exercises no secondary muscles in version 3', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v2 = new Dexie('upgrade', options)
    v2.version(1).stores(STORES_V1)
    v2.version(2).stores({ errors: '++seq' })
    const exercise = {
      id: '01960000-0000-7000-8000-000000000002',
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt: null,
      nameZh: '地雷管推举',
      nameEn: null,
      muscle: 'shoulders',
      equipment: 'barbell',
      defaultRestS: 90,
    }
    await v2.table('exercises').add(exercise)
    v2.close()

    const v3 = new GainframeDb('upgrade', options)
    expect(await v3.exercises.get(exercise.id)).toEqual({ ...exercise, secondaryMuscles: [] })
    expect(await v3.outbox.count()).toBe(0)
    expect(v3.verno).toBe(6)
    v3.close()
  })

  it('moves version 3 sets into one slot per workout and exercise in version 4', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v3 = new Dexie('upgrade', options)
    v3.version(1).stores(STORES_V1)
    v3.version(2).stores({ errors: '++seq' })
    v3.version(3).stores({})
    const workoutId = '01960000-0000-7000-8000-0000000000a1'
    const bench = '01960000-0000-7000-8000-0000000000b1'
    const row = (n: number, deletedAt: string | null = null) => ({
      id: `01960000-0000-7000-8000-00000000000${String(n)}`,
      userId: null,
      createdAt: '2026-11-08T10:00:00.000Z',
      updatedAt: '2026-11-08T10:00:00.000Z',
      deletedAt,
    })
    const set = (n: number, exerciseId: string, position: number, deletedAt: string | null) => ({
      ...row(n, deletedAt),
      workoutId,
      exerciseId,
      supersetGroup: n === 1 ? 2 : null,
      position,
      kind: 'working',
      weightKg: 60,
      reps: 8,
      rpe: null,
      completedAt: '2026-11-08T10:05:00.000Z',
    })
    // Bench (positions 0, 2) comes before squat (position 1, deleted).
    const sets = [
      set(1, bench, 0, null),
      set(2, '01960000-0000-7000-8000-0000000000b2', 1, '2026-11-08T10:06:00.000Z'),
      set(3, bench, 2, null),
    ]
    await v3.table('workoutSets').bulkAdd(sets)
    v3.close()

    const v4 = new GainframeDb('upgrade', options)
    const slots = await v4.workoutExercises.orderBy('id').toArray()
    const [benchSlot, squatSlot] = slots.toSorted((a, b) => a.position - b.position)
    expect(slots).toHaveLength(2)
    expect(benchSlot).toMatchObject({
      exerciseId: bench,
      position: 0,
      supersetGroup: 2,
      note: null,
    })
    expect(benchSlot?.deletedAt).toBeNull()
    expect(squatSlot?.position).toBe(1)
    expect(squatSlot?.deletedAt).not.toBeNull()

    for (const old of sets) {
      const moved = await v4.workoutSets.get(old.id)
      const slot = old.exerciseId === bench ? benchSlot : squatSlot
      expect(moved?.workoutExerciseId).toBe(slot?.id)
      expect(moved).not.toHaveProperty('supersetGroup')
      expect(moved?.updatedAt).not.toBe(old.updatedAt)
    }
    expect(await v4.outbox.count()).toBe(slots.length + sets.length)
    v4.close()
  })
  it("renames a version 4 workout's template to its plan day in version 5", async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v4 = new Dexie('upgrade', options)
    v4.version(1).stores(STORES_V1)
    v4.version(2).stores({ errors: '++seq' })
    v4.version(3).stores({})
    v4.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    const workout = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
      startedAt: '2026-11-09T10:00:00.000Z',
      endedAt: '2026-11-09T11:00:00.000Z',
      templateId: null,
      localDate: '2026-11-09',
      note: null,
    }
    await v4.table('workouts').add(workout)
    v4.close()

    const v5 = new GainframeDb('upgrade', options)
    const { templateId, ...rest } = workout
    expect(await v5.workouts.get(workout.id)).toEqual({ ...rest, planDayId: templateId })
    expect(v5.tables.map((table) => table.name)).not.toContain('templates')
    expect(await v5.settings.count()).toBe(0)
    expect(await v5.outbox.count()).toBe(0)
    expect(v5.verno).toBe(6)
    v5.close()
  })

  it('gives version 5 exercise slots no rep range or rest in version 6', async () => {
    const indexedDB = new IDBFactory()
    const options = { indexedDB, IDBKeyRange }

    const v5 = new Dexie('upgrade', options)
    v5.version(1).stores(STORES_V1)
    v5.version(2).stores({ errors: '++seq' })
    v5.version(3).stores({})
    v5.version(4).stores({
      workoutExercises: 'id, workoutId, exerciseId',
      workoutSets: 'id, workoutId, exerciseId, workoutExerciseId',
    })
    v5.version(5).stores({
      templates: null,
      templateItems: null,
      plans: 'id',
      planDays: 'id, planId',
      planItems: 'id, planId, planDayId',
      workouts: 'id, startedAt, planDayId',
      settings: 'key',
    })
    const slot = {
      id: '01960000-0000-7000-8000-000000000001',
      userId: null,
      createdAt: '2026-11-09T10:00:00.000Z',
      updatedAt: '2026-11-09T10:00:00.000Z',
      deletedAt: null,
      workoutId: '01960000-0000-7000-8000-0000000000a1',
      exerciseId: '00000000-0000-7000-8000-000000000001',
      position: 0,
      supersetGroup: null,
      note: null,
    }
    await v5.table('workoutExercises').add(slot)
    v5.close()

    const v6 = new GainframeDb('upgrade', options)
    expect(await v6.workoutExercises.get(slot.id)).toEqual({
      ...slot,
      repsMin: null,
      repsMax: null,
      restS: null,
    })
    expect(await v6.outbox.count()).toBe(0)
    expect(v6.verno).toBe(6)
    v6.close()
  })
})
